import { STAFF_STATUSES, type StaffOrderDetails, type StaffOrderScalar, type StaffOrdersPage, type StaffOrdersQuery, type StaffUpdateStatusInput } from '@/types/staff';

export type StaffApiErrorCode = 'BAD_REQUEST' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'HTTP'
  | 'NETWORK' | 'TIMEOUT' | 'ABORTED' | 'INVALID_RESPONSE' | 'CONFIGURATION' | 'WRITES_DISABLED';

export class StaffApiError extends Error {
  constructor(public readonly code: StaffApiErrorCode, message: string, public readonly status?: number) {
    super(message);
    this.name = 'StaffApiError';
  }
}

interface StaffApiOptions {
  /** Explicit backend base URL. No environment fallback or automatic connection. */
  baseUrl: string;
  /** Read the current token for each request; do not capture an old account's token. */
  getAccessToken: () => string | null;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  /** Future integration must explicitly opt in. The demo dashboard never uses this client. */
  allowStatusUpdates?: boolean;
}

type RequestOptions = { signal?: AbortSignal };
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const amount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const integer = (value: unknown, minimum: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const status = (value: unknown) => typeof value === 'string' && Object.hasOwn(STAFF_STATUSES, value);

const MAX_PAGE = 2147483647;
const MAX_LIMIT = 100;

function validPagination(page: unknown, limit: unknown): page is number {
  return integer(page, 1) && page <= MAX_PAGE && integer(limit, 1) && limit <= MAX_LIMIT
    && (page - 1) * limit <= MAX_PAGE;
}

function isOrderScalar(value: unknown): value is StaffOrderScalar {
  if (!record(value)) return false;
  return text(value.id) && typeof value.customerName === 'string' && typeof value.customerPhone === 'string'
    && nullableText(value.userId) && (value.tableNumber === null || integer(value.tableNumber, -2147483648))
    && nullableText(value.notes) && status(value.status) && amount(value.totalAmount)
    && amount(value.subtotalAmount) && amount(value.discountAmount)
    && (value.reservationStatus === null || ['HELD', 'CONSUMED', 'RELEASED'].includes(String(value.reservationStatus)))
    && (value.reservationExpiresAt === null || date(value.reservationExpiresAt))
    && nullableText(value.promotionId) && nullableText(value.promotionCode)
    && date(value.createdAt) && date(value.updatedAt);
}

function isOrder(value: unknown): value is StaffOrderDetails {
  if (!record(value)) return false;
  const payment = value.payment;
  return isOrderScalar(value)
    && Array.isArray(value.items) && value.items.every((item: unknown) => record(item)
      && text(item.id) && item.orderId === value.id && text(item.productId) && text(item.productName) && amount(item.unitPrice)
      && integer(item.quantity, 1) && text(item.size) && nullableText(item.toppings) && amount(item.itemTotal))
    && (payment === null || (record(payment) && text(payment.id)
      && amount(payment.amount) && ['SEPAY_QR', 'CASH'].includes(String(payment.method))
      && ['PENDING', 'SUCCESS', 'FAILED'].includes(String(payment.status))
      && (payment.paidAt === null || date(payment.paidAt))));
}

function invalidResponse(): never {
  throw new StaffApiError('INVALID_RESPONSE', 'Dữ liệu đơn hàng không đúng hợp đồng Staff.');
}

function parseOrder(value: unknown): StaffOrderDetails {
  if (!isOrder(value)) return invalidResponse();
  return value;
}

function parseStatusResult(value: unknown): StaffOrderScalar {
  if (!isOrderScalar(value)) return invalidResponse();
  return value;
}

function parsePage(value: unknown): StaffOrdersPage {
  if (!record(value) || value.success === false) return invalidResponse();
  const { data, pagination } = value;
  if (!Array.isArray(data) || !data.every(isOrder)) return invalidResponse();
  if (new Set(data.map((order) => order.id)).size !== data.length) return invalidResponse();
  if (!record(pagination) || !validPagination(pagination.page, pagination.limit)
    || !integer(pagination.limit, 1) || !integer(pagination.total, 0) || !integer(pagination.totalPages, 0)
    || pagination.totalPages !== Math.ceil(pagination.total / pagination.limit)) return invalidResponse();
  return { data, pagination: { page: pagination.page, limit: pagination.limit, total: pagination.total, totalPages: pagination.totalPages } };
}

function httpError(status: number) {
  const errors: Partial<Record<number, [StaffApiErrorCode, string]>> = {
    400: ['BAD_REQUEST', 'Yêu cầu đơn hàng không hợp lệ. Kiểm tra bộ lọc, phân trang hoặc trạng thái.'],
    401: ['UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'],
    403: ['FORBIDDEN', 'Bạn không có quyền thao tác với đơn hàng nhân viên.'],
    404: ['NOT_FOUND', 'Không tìm thấy đơn hàng hoặc API Staff.'],
    409: ['CONFLICT', 'Đơn hàng đã thay đổi hoặc không thể chuyển trạng thái. Hãy tải lại đơn.'],
  };
  const [code, message] = errors[status] ?? ['HTTP', 'Không thể xử lý yêu cầu đơn hàng. Vui lòng thử lại.'];
  return new StaffApiError(code, message, status);
}

export function createStaffApiClient(options: StaffApiOptions) {
  let base: URL;
  try { base = new URL(options.baseUrl); } catch { throw new StaffApiError('CONFIGURATION', 'Cần cấu hình URL Backend Staff hợp lệ.'); }
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash
    || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new StaffApiError('CONFIGURATION', 'Cấu hình kết nối Staff không hợp lệ.');
  }
  const baseUrl = base.toString().replace(/\/$/, '');
  const fetcher = options.fetcher ?? fetch;

  async function request(path: string, requestOptions: RequestOptions, body?: StaffUpdateStatusInput): Promise<unknown> {
    const token = options.getAccessToken();
    if (!token?.trim()) throw new StaffApiError('UNAUTHENTICATED', 'Vui lòng đăng nhập để sử dụng API Staff.', 401);
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    if (requestOptions.signal?.aborted) cancel();
    else requestOptions.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const checkAbort = () => {
      if (controller.signal.aborted) throw new StaffApiError(timedOut ? 'TIMEOUT' : 'ABORTED', timedOut ? 'Kết nối Staff quá thời gian chờ.' : 'Yêu cầu Staff đã bị hủy.');
    };
    try {
      checkAbort();
      const response = await fetcher(`${baseUrl}${path}`, {
        method: body ? 'PATCH' : 'GET', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      checkAbort();
      if (!response.ok) throw httpError(response.status);
      let json: unknown;
      try { json = await response.json(); } catch { checkAbort(); return invalidResponse(); }
      checkAbort();
      return json;
    } catch (error) {
      checkAbort();
      if (error instanceof StaffApiError) throw error;
      throw new StaffApiError('NETWORK', 'Không thể kết nối Backend Staff. Kiểm tra mạng rồi thử lại.');
    } finally {
      clearTimeout(timer);
      requestOptions.signal?.removeEventListener('abort', cancel);
    }
  }

  function orderPath(id: string) {
    if (!id.trim() || id === '.' || id === '..') throw new StaffApiError('CONFIGURATION', 'Mã đơn hàng không hợp lệ.');
    return `/staff/orders/${encodeURIComponent(id)}`;
  }

  return {
    async listOrders(query: StaffOrdersQuery = {}, requestOptions: RequestOptions = {}): Promise<StaffOrdersPage> {
      const params = new URLSearchParams();
      if (query.status !== undefined) {
        if (!status(query.status)) throw new StaffApiError('CONFIGURATION', 'Bộ lọc trạng thái không hợp lệ.');
        params.set('status', query.status);
      }
      if (!validPagination(query.page ?? 1, query.limit ?? 20)) {
        throw new StaffApiError('CONFIGURATION', 'Phân trang vượt giới hạn Backend Staff.');
      }
      for (const key of ['page', 'limit'] as const) {
        if (query[key] !== undefined) {
          if (!integer(query[key], 1)) throw new StaffApiError('CONFIGURATION', 'Phân trang không hợp lệ.');
          params.set(key, String(query[key]));
        }
      }
      return parsePage(await request(`/staff/orders${params.size ? `?${params}` : ''}`, requestOptions));
    },
    async getOrder(id: string, requestOptions: RequestOptions = {}): Promise<StaffOrderDetails> {
      return parseOrder(await request(orderPath(id), requestOptions));
    },
    async updateOrderStatus(id: string, input: StaffUpdateStatusInput, requestOptions: RequestOptions = {}): Promise<StaffOrderScalar> {
      if (!options.allowStatusUpdates) throw new StaffApiError('WRITES_DISABLED', 'Cập nhật đơn đang khóa cho đến khi có API Staff an toàn.');
      if (!['PREPARING', 'READY', 'COMPLETED'].includes(input.status)) throw new StaffApiError('CONFIGURATION', 'Trạng thái đích không hợp lệ.');
      return parseStatusResult(await request(`${orderPath(id)}/status`, requestOptions, { status: input.status }));
    },
  };
}
