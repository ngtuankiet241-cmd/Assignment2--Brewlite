export interface PromotionQuote {
  valid: true;
  code: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data !== 'object' || data === null || !('message' in data)) return fallback;
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (Array.isArray(data.message)) {
    const messages = data.message.filter((message): message is string => typeof message === 'string' && !!message.trim());
    if (messages.length > 0) return messages.join(' ');
  }
  return fallback;
}

function isPromotionQuote(data: unknown, subtotalAmount: number): data is PromotionQuote {
  if (typeof data !== 'object' || data === null) return false;
  const quote = data as Record<string, unknown>;
  return quote.valid === true && typeof quote.code === 'string' && !!quote.code.trim() &&
    quote.subtotalAmount === subtotalAmount &&
    typeof quote.discountAmount === 'number' && Number.isSafeInteger(quote.discountAmount) &&
    quote.discountAmount >= 0 && quote.discountAmount <= subtotalAmount &&
    typeof quote.totalAmount === 'number' && Number.isSafeInteger(quote.totalAmount) &&
    quote.totalAmount === subtotalAmount - quote.discountAmount;
}

export async function requestPromotionQuote(
  apiUrl: string,
  code: string,
  subtotalAmount: number,
  signal?: AbortSignal,
): Promise<PromotionQuote> {
  if (!code.trim()) throw new Error('Vui lòng nhập mã giảm giá.');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/promotions/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim(), subtotalAmount }),
    signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(data, 'Không thể áp dụng mã giảm giá. Vui lòng thử lại.'));
  }
  if (!isPromotionQuote(data, subtotalAmount)) {
    throw new Error('Không thể xác nhận số tiền giảm. Vui lòng thử lại.');
  }
  return data;
}
