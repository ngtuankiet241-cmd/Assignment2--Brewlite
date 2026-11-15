import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { DrinkSizeOption, Product, ToppingOption } from '@prisma/client';

interface OrderItemInput {
  productId: string;
  quantity: number;
  size?: string;
  toppings?: string;
}

function priceToppings(
  value: unknown,
  availableToppings: readonly Pick<ToppingOption, 'name' | 'unitPrice'>[],
) {
  if (value === undefined || value === '') return { toppings: undefined, price: 0 };
  if (typeof value !== 'string') throw new BadRequestException('Topping phải là chuỗi ký tự.');
  const quantities = new Map<string, number>();
  let price = 0;
  for (const entry of value.split(',')) {
    // Matches the existing checkout payload: "Trân châu đen x2, Thạch đào".
    const match = /^(.+?)(?:\s+[x×]\s*(\d+))?$/.exec(entry.trim());
    const name = match?.[1];
    const quantity = match?.[2] === undefined ? 1 : Number(match[2]);
    const option = availableToppings.find((topping) => topping.name === name);
    if (option && (!Number.isSafeInteger(option.unitPrice) || option.unitPrice < 0)) {
      throw new InternalServerErrorException('Cấu hình giá topping không hợp lệ.');
    }
    if (!name || !option || !Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Topping hoặc số lượng topping không hợp lệ.');
    }
    const total = (quantities.get(name) ?? 0) + quantity;
    if (total > 5) throw new BadRequestException('Mỗi loại topping chỉ được chọn tối đa 5 phần.');
    quantities.set(name, total);
    price += option.unitPrice * quantity;
  }
  return {
    toppings: [...quantities].map(([name, quantity]) => quantity > 1 ? `${name} x${quantity}` : name).join(', '),
    price,
  };
}

export function priceOrderItems(
  inputs: readonly OrderItemInput[],
  products: readonly Pick<Product, 'id' | 'name' | 'price'>[],
  sizes: readonly Pick<DrinkSizeOption, 'id' | 'priceAdjustment'>[],
  availableToppings: readonly Pick<ToppingOption, 'name' | 'unitPrice'>[],
) {
  const byId = new Map(products.map((product) => [product.id, product]));
  let subtotalAmount = 0;
  const items = inputs.map((input) => {
    const product = byId.get(input.productId);
    if (!product) throw new NotFoundException(`Product with ID ${input.productId} was not found`);
    const size = input.size === undefined ? 'M' : input.size;
    const sizeOption = sizes.find((option) => option.id === size);
    if (!sizeOption) throw new BadRequestException('Kích cỡ không hợp lệ.');
    const topping = priceToppings(input.toppings, availableToppings);
    const unitPrice = Math.max(0, product.price + sizeOption.priceAdjustment + topping.price);
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
