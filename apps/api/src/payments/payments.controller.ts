import { Controller, Post, Body, Headers } from '@nestjs/common';
import { PaymentsService, CreatePaymentCheckoutDto, SepayWebhookPayload } from './payments.service';
import { resolveIdempotencyKey } from '../common/idempotency';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  @Post('sepay/webhook-ipn')
  handleWebhookIpn(@Body() payload: SepayWebhookPayload) {
    return this.paymentsService.handleWebhookIpn(payload);
  }
}

