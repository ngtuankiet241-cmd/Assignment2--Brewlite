import type { ProductConfiguration } from '@/types/cart';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProductConfiguration(value: unknown): ProductConfiguration {
  const envelope = isRecord(value) ? value : null;
  const data = envelope && envelope.success !== false ? envelope.data : null;
  if (!isRecord(data) || !Array.isArray(data.sizes) || !Array.isArray(data.toppings)) {
    throw new Error('Dữ liệu tùy chọn sản phẩm từ máy chủ không hợp lệ.');
  }

  const sizes = data.sizes.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' || value.id.trim() === '' ||
      typeof value.label !== 'string' || value.label.trim() === '' ||
      typeof value.priceAdjustment !== 'number' ||
      !Number.isSafeInteger(value.priceAdjustment)
    ) {
      throw new Error('Dữ liệu kích cỡ từ máy chủ không hợp lệ.');
    }

    return {
      id: value.id,
      label: value.label,
      priceAdjustment: value.priceAdjustment,
    };
  });

  const toppings = data.toppings.map((value) => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' || value.id.trim() === '' ||
      typeof value.name !== 'string' || value.name.trim() === '' ||
      typeof value.unitPrice !== 'number' ||
      !Number.isSafeInteger(value.unitPrice) || value.unitPrice < 0
    ) {
      throw new Error('Dữ liệu topping từ máy chủ không hợp lệ.');
    }

    return {
      id: value.id,
      name: value.name,
      unitPrice: value.unitPrice,
    };
  });

  return { sizes, toppings };
}
