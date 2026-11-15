import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { timingSafeEqual } from 'crypto';

import {
  PaymentsService,
  CreatePaymentCheckoutDto,
  SePayGatewayIpn,
} from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  // API tạo mã QR thanh toán cũ
  @Post('sepay/checkout')
  createCheckout(
    @Body() dto: CreatePaymentCheckoutDto,
    @Headers('x-idempotency-key') idempotencyHeader?: string,
  ) {
    if (idempotencyHeader && !dto.idempotencyKey) {
      dto.idempotencyKey = idempotencyHeader;
    }

    return this.paymentsService.createCheckout(dto);
  }

  // API tạo biểu mẫu thanh toán SePay Sandbox
  @Post('sepay/checkout-form')
  createCheckoutForm(@Body('orderId') orderId: string) {
    return this.paymentsService.createSePayCheckoutForm(orderId);
  }

  // API nhận IPN từ SePay
  @Post('sepay/webhook-ipn')
  handleWebhookIpn(
    @Headers('x-secret-key') receivedKey: string | undefined,
    @Body() payload: SePayGatewayIpn,
  ) {
    const expectedKey = process.env.SEPAY_IPN_SECRET_KEY;

    if (!expectedKey) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình khóa xác thực IPN.',
      );
    }

    const received = Buffer.from(receivedKey ?? '', 'utf8');
    const expected = Buffer.from(expectedKey, 'utf8');

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException(
        'Thông báo thanh toán không được xác thực.',
      );
    }

    return this.paymentsService.handleGatewayIpn(payload);
  }

@Get('sepay/test-balance')
@UseGuards(JwtAuthGuard)
getSePayTestBalance() {
  return this.paymentsService.getSePayTestBalance();
}

}
