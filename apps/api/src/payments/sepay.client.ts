
import { InternalServerErrorException } from '@nestjs/common';
import { SePayPgClient } from 'sepay-pg-node';

export function createSePayClient(): SePayPgClient {
  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const secretKey = process.env.SEPAY_SECRET_KEY;

  if (!merchantId || !secretKey) {
    throw new InternalServerErrorException(
      'Chưa cấu hình thông tin SePay.',
    );
  }

  return new SePayPgClient({
    env: 'sandbox',
    merchant_id: merchantId,
    secret_key: secretKey,
  });
}
