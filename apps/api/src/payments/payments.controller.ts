import { Controller, Post, Body, Headers } from '@nestjs/common';
import { PaymentsService, CreatePaymentCheckoutDto, SepayWebhookPayload } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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

  @Post('sepay/webhook-ipn')
  handleWebhookIpn(@Body() payload: SepayWebhookPayload) {
    return this.paymentsService.handleWebhookIpn(payload);
  }
}
