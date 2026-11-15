const statuses = ['PENDING', 'PAID', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'PAYMENT_FAILED', 'CANCELLED'] as const;
export type OrderPaymentStatus = typeof statuses[number];

export async function requestPaymentStatus(apiUrl: string, orderId: string, token: string | null, signal: AbortSignal): Promise<OrderPaymentStatus> {
  const base = apiUrl.replace(/\/$/, '');
  // Signed-in customers can recover a missed IPN through a server-side SePay
  // lookup. The browser never supplies evidence that a payment succeeded.
  const response = token
    ? await fetch(`${base}/payments/sepay/sync`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }), cache: 'no-store', signal,
    })
    : await fetch(`${base}/orders/${encodeURIComponent(orderId)}/status`, { cache: 'no-store', signal });
  if (!response.ok) {
    throw new Error(response.status === 401
      ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để đối chiếu thanh toán.'
      : 'Chưa thể xác nhận thanh toán. Bạn có thể kiểm tra lại sau ít giây.');
  }
  let body: unknown;
  try { body = await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Chưa nhận được trạng thái thanh toán hợp lệ. Vui lòng kiểm tra lại.');
  }
  if (!body || typeof body !== 'object' || !('status' in body) ||
      !statuses.includes(body.status as OrderPaymentStatus) ||
      (token ? !('orderId' in body) || body.orderId !== orderId : !('id' in body) || body.id !== orderId)) {
    throw new Error('Chưa nhận được trạng thái thanh toán hợp lệ. Vui lòng kiểm tra lại.');
  }
  return body.status as OrderPaymentStatus;
}
