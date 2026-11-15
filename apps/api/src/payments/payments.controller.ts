import { resolveIdempotencyKey } from '../common/idempotency';
import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  UnauthorizedException,
  ServiceUnavailableException,
  HttpCode,
} from '@nestjs/common';

import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { timingSafeEqual } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/auth.service';

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
    @Headers('idempotency-key') idempotencyHeader?: string,
    @Headers('x-idempotency-key') legacyHeader?: string,
  ) {
    return this.paymentsService.createCheckout({
      ...dto,
      idempotencyKey: resolveIdempotencyKey(idempotencyHeader, legacyHeader, dto?.idempotencyKey),
    });
  }

  // API tạo biểu mẫu thanh toán SePay Sandbox
  @Post('sepay/checkout-form')
  createCheckoutForm(
    @Body('orderId') orderId: string,
    @Headers('idempotency-key') key?: string,
    @Headers('x-idempotency-key') legacyKey?: string,
  ) {
    return this.paymentsService.createSePayCheckoutForm(orderId, resolveIdempotencyKey(key, legacyKey));
  }

  // API nhận IPN từ SePay
  @Post(['sepay/webhook-ipn', 'ipn'])
  @HttpCode(200)
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

  @Post('sepay/sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  syncPayment(@Body('orderId') orderId: string, @CurrentUser() user: JwtPayload) {
    return this.paymentsService.syncSePayPayment(orderId, user.userId);
  }

@Get('sepay/test-balance')
@UseGuards(JwtAuthGuard)
getSePayTestBalance() {
  return this.paymentsService.getSePayTestBalance();
}

}
