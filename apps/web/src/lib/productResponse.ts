export interface BackendProduct {
  id: string | number;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
}

function isBackendProduct(value: unknown): value is BackendProduct {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    ((typeof item.id === 'string' && item.id.trim() !== '') ||
      (typeof item.id === 'number' && Number.isFinite(item.id))) &&
    typeof item.name === 'string' && item.name.trim() !== '' &&
    typeof item.description === 'string' &&
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 &&
    typeof item.imageUrl === 'string' &&
    typeof item.stock === 'number' && Number.isInteger(item.stock) && item.stock >= 0
  );
}

// Accept both the NestJS envelope and the deployed API's array response.
// The legacy MOCK_PRODUCTS fallback has no stock and fails this contract.
export function parseProductsResponse(value: unknown): BackendProduct[] {
  const envelope = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  const list = Array.isArray(value) ? value : envelope?.data;

  if (
    envelope?.success === false || envelope?.fallback === true ||
    envelope?.source === 'mock' || envelope?.source === 'fallback' ||
    !Array.isArray(list) || !list.every(isBackendProduct)
  ) {
    throw new Error('Dữ liệu sản phẩm từ máy chủ không hợp lệ. Vui lòng thử lại.');
  }

  return list;
}
