import { ServiceUnavailableException } from '@nestjs/common';
import { retrieveSePayOrder } from './sepay.client';

describe('SePay order lookup', () => {
  const originalFetch = global.fetch;
  const originalMerchant = process.env.SEPAY_MERCHANT_ID;
  const originalSecret = process.env.SEPAY_SECRET_KEY;
  let fetcher: jest.Mock;
  beforeEach(() => {
    process.env.SEPAY_MERCHANT_ID = 'test-merchant';
    process.env.SEPAY_SECRET_KEY = 'test-merchant-key';
    fetcher = jest.fn().mockResolvedValue(Response.json({ data: { order_status: 'CAPTURED' } }));
    global.fetch = fetcher;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalMerchant === undefined) delete process.env.SEPAY_MERCHANT_ID;
    else process.env.SEPAY_MERCHANT_ID = originalMerchant;
    if (originalSecret === undefined) delete process.env.SEPAY_SECRET_KEY;
    else process.env.SEPAY_SECRET_KEY = originalSecret;
  });

  it('uses the sandbox API with server credentials, URL encoding, no cache and a timeout signal', async () => {
    expect(await retrieveSePayOrder('order /1')).toEqual({ data: { order_status: 'CAPTURED' } });
    expect(fetcher).toHaveBeenCalledWith('https://pgapi-sandbox.sepay.vn/v1/order/detail/order%20%2F1', {
      headers: { Authorization: `Basic ${Buffer.from('test-merchant:test-merchant-key').toString('base64')}`, Accept: 'application/json' },
      cache: 'no-store', signal: expect.any(AbortSignal),
    });
  });

  it('does not contact SePay with missing credentials', async () => {
    delete process.env.SEPAY_SECRET_KEY;
    await expect(retrieveSePayOrder('order-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('treats a missing remote order as unconfirmed', async () => {
    fetcher.mockResolvedValue(new Response('', { status: 404 }));
    expect(await retrieveSePayOrder('order-1')).toBeNull();
  });

  it.each([401, 429, 503])('masks provider HTTP %s without returning response content', async (status) => {
    fetcher.mockResolvedValue(new Response('private provider response', { status }));
    await expect(retrieveSePayOrder('order-1')).rejects.toThrow('Chưa thể đối chiếu thanh toán với SePay. Vui lòng thử lại.');
  });

  it('masks timeouts, network errors and invalid JSON', async () => {
    fetcher.mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'));
    await expect(retrieveSePayOrder('order-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    fetcher.mockRejectedValueOnce(new TypeError('Network failure'));
    await expect(retrieveSePayOrder('order-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    fetcher.mockResolvedValueOnce(new Response('invalid json'));
    await expect(retrieveSePayOrder('order-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
