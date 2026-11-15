
import { InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
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

// Keep merchant credentials on the server, including when an IPN was missed.
export async function retrieveSePayOrder(orderId: string): Promise<unknown> {
  const merchantId = process.env.SEPAY_MERCHANT_ID;
  const secretKey = process.env.SEPAY_SECRET_KEY;
  if (!merchantId || !secretKey) {
    throw new ServiceUnavailableException('Chưa cấu hình thông tin SePay.');
  }
  try {
    const response = await fetch(
      `https://pgapi-sandbox.sepay.vn/v1/order/detail/${encodeURIComponent(orderId)}`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`${merchantId}:${secretKey}`).toString('base64')}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), cache: 'no-store',
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('SePay lookup failed');
    return await response.json();
  } catch {
    throw new ServiceUnavailableException('Chưa thể đối chiếu thanh toán với SePay. Vui lòng thử lại.');
  }
}
