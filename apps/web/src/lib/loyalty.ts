export interface LoyaltyEntry {
  id: string;
  orderId: string | null;
  type: 'EARN' | 'REDEEM';
  points: number;
  description: string | null;
  createdAt: string;
}

export interface LoyaltyAccount {
  loyaltyPoints: number;
  vndPerPoint: number;
  transactions: LoyaltyEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEntry(value: unknown): value is LoyaltyEntry {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 &&
    (value.orderId === null || typeof value.orderId === 'string') &&
    (value.type === 'EARN' || value.type === 'REDEEM') &&
    typeof value.points === 'number' && Number.isSafeInteger(value.points) && value.points > 0 &&
    (value.description === null || typeof value.description === 'string') &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
}

export async function requestLoyaltyAccount(apiUrl: string, token: string, signal?: AbortSignal): Promise<LoyaltyAccount> {
  if (!token) throw new Error('Vui lòng đăng nhập để xem điểm thưởng.');
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/loyalty/me`, {
    headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal,
  });
  if (response.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  if (!response.ok) throw new Error('Không tải được điểm thưởng. Vui lòng thử lại.');
  let body: unknown;
  try { body = await response.json(); }
  catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Dữ liệu điểm thưởng không hợp lệ. Vui lòng thử lại.');
  }
  if (!isRecord(body) || typeof body.loyaltyPoints !== 'number' || !Number.isSafeInteger(body.loyaltyPoints) ||
      body.loyaltyPoints < 0 || typeof body.vndPerPoint !== 'number' || !Number.isSafeInteger(body.vndPerPoint) ||
      body.vndPerPoint <= 0 || !Array.isArray(body.transactions) || !body.transactions.every(isEntry)) {
    throw new Error('Dữ liệu điểm thưởng không hợp lệ. Vui lòng thử lại.');
  }
  return { loyaltyPoints: body.loyaltyPoints, vndPerPoint: body.vndPerPoint, transactions: body.transactions };
}
