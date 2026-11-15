import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  changeOrderStatus,
  lockOrder,
} from '../orders/order-transition';

import { createSePayClient } from './sepay.client';
import { InventoryService } from '../inventory/inventory.service';
import { assertReservationActive } from '../inventory/stock-reservation';

export interface CreatePaymentCheckoutDto {
  orderId: string;
  amount: number;
  idempotencyKey?: string;
}

export interface SepayWebhookPayload {
  orderId: string;
  transactionRef: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
}

export interface SePayGatewayIpn {
  timestamp: number;
  notification_type: string;
  order: {
    order_invoice_number: string;
    order_status: string;
    order_amount: string;
    order_currency: string;
  };
  transaction: {
    transaction_id: string;
    transaction_type: string;
    transaction_status: string;
    transaction_amount: string;
    transaction_currency: string;
  };
}


@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async createCheckout(dto: CreatePaymentCheckoutDto) {
    await this.inventory.expireReservations(dto.orderId);
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, dto.orderId);
      assertReservationActive(order);
      if (!Number.isSafeInteger(dto.amount) || dto.amount !== order.totalAmount) {
        throw new BadRequestException('Số tiền thanh toán phải khớp tổng tiền sau giảm giá của đơn hàng.');
      }

      if (dto.idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (existing.orderId !== order.id) {
            throw new ConflictException('Idempotency key đã được sử dụng cho đơn hàng khác.');
          }
          return existing;
        }
      }

      if (order.status === OrderStatus.PAYMENT_FAILED) {
        await changeOrderStatus(tx, order.id, OrderStatus.PENDING);
      } else if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException(`Không thể tạo thanh toán cho đơn ở trạng thái ${order.status}.`);
      }

      const transactionRef = `SEPAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const qrUrl = `https://qr.sepay.vn/img?acc=BREWLITE&bank=MBBank&amount=${order.totalAmount}&des=${transactionRef}`;

      return tx.payment.upsert({
        where: { orderId: dto.orderId },
        update: {
          amount: order.totalAmount,
          transactionRef,
          idempotencyKey: dto.idempotencyKey,
          qrUrl,
          status: 'PENDING',
          paidAt: null,
        },
        create: {
          orderId: dto.orderId,
          amount: order.totalAmount,
          transactionRef,
          idempotencyKey: dto.idempotencyKey,
          qrUrl,
          status: 'PENDING',
        },
      });
    });
  }

  async handleWebhookIpn(payload: SepayWebhookPayload) {
    if (payload?.status !== 'SUCCESS' && payload?.status !== 'FAILED') {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ.');
    }

    await this.inventory.expireReservations(payload.orderId);
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, payload.orderId);
      const payment = await tx.payment.findUnique({ where: { orderId: order.id } });
      if (!payment) throw new NotFoundException(`Payment for order ${order.id} not found`);
      if (!Number.isSafeInteger(payload.amount) || payload.amount !== order.totalAmount || payload.amount !== payment.amount) {
        throw new BadRequestException('Số tiền giao dịch không khớp số tiền cần thanh toán.');
      }

      // An exact replay is a no-op, even after preparation or completion.
      if (payment.status === payload.status && payment.transactionRef === payload.transactionRef &&
          payment.amount === payload.amount) {
        return payment;
      }
      if (payment.status === 'SUCCESS') {
        throw new ConflictException('Không thể thay đổi giao dịch đã thanh toán thành công.');
      }

      const isSuccess = payload.status === 'SUCCESS';
      await changeOrderStatus(tx, order.id, isSuccess ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED);
      return tx.payment.update({
        where: { orderId: payload.orderId },
        data: {
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          transactionRef: payload.transactionRef,
          paidAt: isSuccess ? new Date() : null,
        },
      });
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã giao dịch thanh toán đã được sử dụng.');
      }
      throw error;
    });
  }

  
async createSePayCheckoutForm(orderId: string) {
  if (typeof orderId !== 'string' || !orderId.trim()) {
    throw new BadRequestException('Mã đơn hàng không hợp lệ.');
  }

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    throw new BadRequestException('Chưa cấu hình FRONTEND_URL.');
  }

  const client = createSePayClient();

  await this.inventory.expireReservations(orderId);

  return this.prisma.$transaction(async (tx) => {
    // Khóa đơn hàng để tránh cập nhật đồng thời.
    const order = await lockOrder(tx, orderId);
    assertReservationActive(order);

    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(
        'Đơn hàng không ở trạng thái chờ thanh toán.',
      );
    }

    if (
      !Number.isSafeInteger(order.totalAmount) ||
      order.totalAmount <= 0
    ) {
      throw new BadRequestException(
        'Số tiền đơn hàng không hợp lệ.',
      );
    }

    const existingPayment = await tx.payment.findUnique({
      where: { orderId: order.id },
    });

    if (existingPayment?.status === 'SUCCESS') {
      throw new ConflictException(
        'Đơn hàng đã được thanh toán.',
      );
    }

    // Lưu giao dịch đang chờ thanh toán.
    if (existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: order.totalAmount,
          method: 'SEPAY_QR',
          status: 'PENDING',
          transactionRef: null,
          idempotencyKey: null,
          qrUrl: null,
          paidAt: null,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          method: 'SEPAY_QR',
          status: 'PENDING',
        },
      });
    }

    const resultUrl =
      `${frontendUrl.replace(/\/$/, '')}/payment/result` +
      `?orderId=${encodeURIComponent(order.id)}`;

    // Tạo biểu mẫu thanh toán từ SDK SePay.
    const fields = client.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: order.id,
      order_amount: order.totalAmount,
      currency: 'VND',
      order_description: `Thanh toan BrewLite ${order.id}`,
      success_url: resultUrl,
      error_url: resultUrl,
      cancel_url: resultUrl,
    });

    return {
      checkoutUrl: client.checkout.initCheckoutUrl(),
      fields,
      orderId: order.id,
      amount: order.totalAmount,
    };
  });
}


async handleGatewayIpn(payload: SePayGatewayIpn) {
  if (
    payload?.notification_type !== 'ORDER_PAID' ||
    payload.order?.order_status !== 'CAPTURED' ||
    payload.transaction?.transaction_status !== 'APPROVED' ||
    payload.transaction?.transaction_type !== 'PAYMENT'
  ) {
    throw new BadRequestException('Thông báo thanh toán không hợp lệ.');
  }

  const orderId = payload.order.order_invoice_number;
  const transactionRef = payload.transaction.transaction_id;

  const amount = Number(payload.transaction.transaction_amount);
  const orderAmount = Number(payload.order.order_amount);

  if (
    !orderId ||
    !transactionRef ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount !== orderAmount ||
    payload.order.order_currency !== 'VND' ||
    payload.transaction.transaction_currency !== 'VND'
  ) {
    throw new BadRequestException('Thông tin giao dịch không hợp lệ.');
  }

  return this.prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);

    const payment = await tx.payment.findUnique({
      where: { orderId: order.id },
    });

    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
    }

    if (order.totalAmount !== amount || payment.amount !== amount) {
      throw new ConflictException('Số tiền thanh toán không khớp.');
    }

    // Chỉ chấp nhận việc gửi lại đúng giao dịch đã xử lý.
    if (payment.status === 'SUCCESS') {
      if (payment.transactionRef !== transactionRef) {
        throw new ConflictException('Giao dịch đã được thanh toán.');
      }

      return { success: true, alreadyProcessed: true };
    }

    if (
      order.status !== OrderStatus.PENDING ||
      payment.status !== 'PENDING'
    ) {
      throw new ConflictException(
        'Trạng thái đơn hàng hoặc thanh toán không hợp lệ.',
      );
    }

    await changeOrderStatus(tx, order.id, OrderStatus.PAID);

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        transactionRef,
        paidAt: new Date(),
      },
    });

    return { success: true };
  });
}

async getSePayTestBalance() {
  const token = process.env.SEPAY_TEST_API_TOKEN;

  if (!token) {
    throw new ServiceUnavailableException(
      'Chưa cấu hình API Token SePay Test Mode.',
    );
  }

  let response: Response;

  try {
    response = await fetch(
      'https://userapi-sandbox.sepay.vn/v2/bank-accounts',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      },
    );
  } catch {
    throw new ServiceUnavailableException(
      'Không kết nối được SePay Test Mode.',
    );
  }

  if (!response.ok) {
    throw new ServiceUnavailableException(
      `SePay API trả về HTTP ${response.status}.`,
    );
  }

  const result = await response.json();

  if (result.status !== 'success' || !Array.isArray(result.data)) {
    throw new ServiceUnavailableException(
      'Dữ liệu số dư SePay không hợp lệ.',
    );
  }

  const accounts = result.data.map(
    (account: {
      id: string;
      bank_short_name: string;
      accumulated: number;
      connection_type: string;
    }) => ({
      id: account.id,
      bank: account.bank_short_name,
      balance: account.accumulated,
      connectionType: account.connection_type,
    }),
  );

  return {
    source: 'SEPAY_TEST_MODE',
    currency: 'VND',
    accounts,
  };
}


}

