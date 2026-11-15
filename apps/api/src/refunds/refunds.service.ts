
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  OrderStatus,
  PaymentStatus,
  RefundStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lockOrder } from '../orders/order-transition';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  // Nhân viên và quản lý xem danh sách yêu cầu hoàn tiền.
  async findAll() {
    return this.prisma.refund.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            customerName: true,
            customerPhone: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        payment: {
          select: {
            amount: true,
            status: true,
            transactionRef: true,
          },
        },
      },
    });
  }

  // Khóa đơn hàng để tránh hai người xử lý đồng thời.
  private async findLockedRefund(
    tx: TransactionClient,
    refundId: string,
  ) {
    const initial = await tx.refund.findUnique({
      where: { id: refundId },
      select: { orderId: true },
    });

    if (!initial) {
      throw new NotFoundException(
        'Không tìm thấy yêu cầu hoàn tiền.',
      );
    }

    const order = await lockOrder(tx, initial.orderId);

    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });

    if (!refund) {
      throw new NotFoundException(
        'Không tìm thấy yêu cầu hoàn tiền.',
      );
    }

    return { refund, order };
  }

  // Xác minh đơn hàng và giao dịch thanh toán gốc.
  private checkPaidOrder(
    order: { status: OrderStatus; totalAmount: number },
    refund: {
      amount: number;
      payment: {
        status: PaymentStatus;
        amount: number;
        transactionRef: string | null;
      };
    },
  ) {
    if (order.status !== OrderStatus.PAID) {
      throw new ConflictException(
        'Đơn hàng không còn ở trạng thái PAID.',
      );
    }

    if (
      refund.payment.status !== PaymentStatus.SUCCESS ||
      !refund.payment.transactionRef ||
      refund.amount !== refund.payment.amount ||
      refund.amount !== order.totalAmount
    ) {
      throw new ConflictException(
        'Giao dịch thanh toán gốc không hợp lệ.',
      );
    }
  }

  // Không cho xử lý hoàn tiền thật sau khi đã mô phỏng.
  private ensureNotDemo(
    refund: { demoCompletedAt: Date | null },
  ) {
    if (refund.demoCompletedAt) {
      throw new ConflictException(
        'Yêu cầu đã hoàn tất mô phỏng. Không được xử lý như giao dịch hoàn tiền thật.',
      );
    }
  }

  // BARISTA hoặc ADMIN duyệt yêu cầu.
  async approve(refundId: string, staffId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { refund, order } =
        await this.findLockedRefund(tx, refundId);

      this.ensureNotDemo(refund);
      this.checkPaidOrder(order, refund);

      if (refund.status !== RefundStatus.REQUESTED) {
        throw new ConflictException(
          'Chỉ có thể duyệt yêu cầu REQUESTED.',
        );
      }

      return tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.PENDING,
          approvedBy: staffId,
          approvedAt: new Date(),
        },
      });
    });
  }

  // BARISTA hoặc ADMIN từ chối yêu cầu.
  async reject(
    refundId: string,
    staffId: string,
    reason: unknown,
  ) {
    if (
      typeof reason !== 'string' ||
      !reason.trim() ||
      reason.trim().length > 500
    ) {
      throw new BadRequestException(
        'Lý do từ chối phải có từ 1 đến 500 ký tự.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { refund, order } =
        await this.findLockedRefund(tx, refundId);

      this.ensureNotDemo(refund);
      this.checkPaidOrder(order, refund);

      if (refund.status !== RefundStatus.REQUESTED) {
        throw new ConflictException(
          'Chỉ có thể từ chối yêu cầu REQUESTED.',
        );
      }

      return tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.REJECTED,
          rejectionReason: reason.trim(),
          errorMessage: reason.trim(),
          completedAt: new Date(),
        },
      });
    });
  }

  // Ghi nhận giao dịch chuyển khoản hoàn tiền thật.
  async recordTransfer(
    refundId: string,
    staffId: string,
    bankTransactionRef: unknown,
    evidenceUrl: unknown,
  ) {
    if (
      typeof bankTransactionRef !== 'string' ||
      !bankTransactionRef.trim() ||
      bankTransactionRef.trim().length > 150
    ) {
      throw new BadRequestException(
        'Mã giao dịch phải có từ 1 đến 150 ký tự.',
      );
    }

    if (
      typeof evidenceUrl !== 'string' ||
      !evidenceUrl.trim() ||
      evidenceUrl.length > 2000
    ) {
      throw new BadRequestException(
        'Bạn phải cung cấp đường dẫn chứng từ hợp lệ.',
      );
    }

    try {
      const url = new URL(evidenceUrl);

      if (!['https:', 'http:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new BadRequestException(
        'Chứng từ phải là đường dẫn HTTP hoặc HTTPS hợp lệ.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { refund, order } =
        await this.findLockedRefund(tx, refundId);

      this.ensureNotDemo(refund);
      this.checkPaidOrder(order, refund);

      if (refund.status !== RefundStatus.PENDING) {
        throw new ConflictException(
          'Yêu cầu chưa được duyệt hoặc đã hoàn tất.',
        );
      }

      if (!refund.approvedAt || !refund.approvedBy) {
        throw new ConflictException(
          'Yêu cầu chưa có thông tin xét duyệt.',
        );
      }

      if (refund.bankTransactionRef) {
        throw new ConflictException(
          'Yêu cầu đã được ghi nhận chuyển khoản.',
        );
      }

      return tx.refund.update({
        where: { id: refundId },
        data: {
          bankTransactionRef: bankTransactionRef.trim(),
          evidenceUrl: evidenceUrl.trim(),
          transferRecordedBy: staffId,
          transferRecordedAt: new Date(),
        },
      });
    });
  }

  // ADMIN xác minh chuyển khoản thật sau khi đối chiếu ngân hàng.
  async verify(
    refundId: string,
    adminId: string,
    confirmed: unknown,
  ) {
    if (confirmed !== true) {
      throw new BadRequestException(
        'Quản lý phải xác nhận đã đối chiếu tiền hoàn.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { refund, order } =
        await this.findLockedRefund(tx, refundId);

      this.ensureNotDemo(refund);
      this.checkPaidOrder(order, refund);

      if (refund.status !== RefundStatus.PENDING) {
        throw new ConflictException(
          'Chỉ có thể xác minh yêu cầu PENDING.',
        );
      }

      if (
        !refund.approvedBy ||
        !refund.approvedAt ||
        !refund.bankTransactionRef ||
        !refund.evidenceUrl ||
        !refund.transferRecordedBy ||
        !refund.transferRecordedAt
      ) {
        throw new ConflictException(
          'Chưa đủ thông tin chuyển khoản để xác minh.',
        );
      }

      if (refund.transferRecordedBy === adminId) {
        throw new ForbiddenException(
          'Người ghi nhận chuyển khoản không được tự xác minh.',
        );
      }

      // Chỉ giao dịch thật đã xác minh mới được cập nhật CANCELLED.
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.SUCCEEDED,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          completedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      return {
        message: 'Đã xác minh hoàn tiền thủ công và hủy đơn hàng.',
        refund: updatedRefund,
      };
    });
  }

  // Hoàn tiền MÔ PHỎNG dành riêng cho Sandbox.
  async completeDemo(refundId: string, adminId: string) {
    if (
  process.env.REFUND_DEMO_ENABLED !== 'true' ||
  process.env.SEPAY_ENV !== 'sandbox'
) {
  throw new ForbiddenException(
    'Chức năng hoàn tiền mô phỏng chỉ được phép trong môi trường Sandbox có bật Demo.',
  );
}

    return this.prisma.$transaction(async (tx) => {
      const { refund, order } =
        await this.findLockedRefund(tx, refundId);

      this.checkPaidOrder(order, refund);

      if (refund.demoCompletedAt) {
        throw new ConflictException(
          'Yêu cầu đã được hoàn tiền mô phỏng trước đó.',
        );
      }

      if (
        refund.status !== RefundStatus.REQUESTED &&
        refund.status !== RefundStatus.PENDING
      ) {
        throw new ConflictException(
          'Trạng thái yêu cầu không cho phép mô phỏng hoàn tiền.',
        );
      }

      if (
        refund.bankTransactionRef ||
        refund.transferRecordedAt ||
        refund.verifiedAt ||
        refund.completedAt
      ) {
        throw new ConflictException(
          'Yêu cầu đã có dữ liệu hoàn tiền thật, không được mô phỏng.',
        );
      }

      // Không cập nhật status thành SUCCEEDED hoặc Order thành CANCELLED.
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          demoReference: `DEMO-REFUND-${randomUUID()}`,
          demoCompletedAt: new Date(),
          demoBy: adminId,
        },
      });

      return {
        message:
          'Hoàn tiền mô phỏng thành công. Không có tiền thật được chuyển.',
        mode: 'DEMO',
        simulated: true,
        amount: updatedRefund.amount,
        demoReference: updatedRefund.demoReference,
        refund: updatedRefund,
      };
    });
  }
}
