import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Product } from '@prisma/client';

const sizeAdjustments = new Map([['S', -5000], ['M', 0], ['L', 5000]]);
const toppingPrices = new Map([['Trân châu đen', 7000], ['Thạch đào', 8000], ['Kem cheese', 10000]]);

interface OrderItemInput {
  productId: string;
  quantity: number;
  size?: string;
  toppings?: string;
}

function priceToppings(value: unknown) {
  if (value === undefined || value === '') return { toppings: undefined, price: 0 };
  if (typeof value !== 'string') throw new BadRequestException('Topping phải là chuỗi ký tự.');
  const quantities = new Map<string, number>();
  for (const entry of value.split(',')) {
    // Matches the existing checkout payload: "Trân châu đen x2, Thạch đào".
    const match = /^(.+?)(?:\s+[x×]\s*(\d+))?$/.exec(entry.trim());
    const name = match?.[1];
    const quantity = match?.[2] === undefined ? 1 : Number(match[2]);
    if (!toppingPrices.has(name) || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Topping hoặc số lượng topping không hợp lệ.');
    }
    const total = (quantities.get(name) ?? 0) + quantity;
    if (total > 5) throw new BadRequestException('Mỗi loại topping chỉ được chọn tối đa 5 phần.');
    quantities.set(name, total);
  }
  return {
    toppings: [...quantities].map(([name, quantity]) => quantity > 1 ? `${name} x${quantity}` : name).join(', '),
    price: [...quantities].reduce((sum, [name, quantity]) => sum + toppingPrices.get(name) * quantity, 0),
  };
}

export function priceOrderItems(inputs: readonly OrderItemInput[], products: readonly Product[]) {
  const byId = new Map(products.map((product) => [product.id, product]));
  let subtotalAmount = 0;
  const items = inputs.map((input) => {
    const product = byId.get(input.productId);
    if (!product) throw new NotFoundException(`Product with ID ${input.productId} was not found`);
    const size = input.size === undefined ? 'M' : input.size;
    if (!sizeAdjustments.has(size)) throw new BadRequestException('Size phải là S, M hoặc L.');
    const topping = priceToppings(input.toppings);
    const unitPrice = Math.max(0, product.price + sizeAdjustments.get(size) + topping.price);
    const itemTotal = unitPrice * input.quantity;
    subtotalAmount += itemTotal;
    if (!Number.isSafeInteger(itemTotal) || itemTotal < 0 || subtotalAmount > 2147483647) {
      throw new BadRequestException('Giá trị đơn hàng vượt giới hạn cho phép.');
    }
    return {
      productId: product.id, productName: product.name, unitPrice, quantity: input.quantity,
      size, toppings: topping.toppings, itemTotal,
    };
  });
  return { items, subtotalAmount };
}
