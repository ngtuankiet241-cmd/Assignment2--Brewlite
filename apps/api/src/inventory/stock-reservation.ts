import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

export class OptimisticStockConflict extends Error {}

export function aggregateQuantities(items: readonly { productId: string; quantity: number }[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim() ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestException('Mỗi sản phẩm phải có mã và số lượng nguyên dương.');
    }
    const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
    if (quantity > 2147483647) {
      throw new BadRequestException('Số lượng sản phẩm vượt giới hạn cho phép.');
    }
    quantities.set(item.productId, quantity);
  }
  // A consistent product order also prevents deadlocks across multi-product carts.
  return new Map([...quantities].sort(([a], [b]) => a.localeCompare(b)));
}

export async function reserveStock(tx: Prisma.TransactionClient, quantities: Map<string, number>) {
  const products = await tx.product.findMany({ where: { id: { in: [...quantities.keys()] } } });
  const byId = new Map(products.map((product) => [product.id, product]));
  for (const [id, quantity] of quantities) {
    const product = byId.get(id);
    if (!product) throw new NotFoundException(`Product with ID ${id} was not found`);
    if (product.stock < quantity) {
      throw new ConflictException({
        statusCode: 409,
        message: `Sản phẩm ${product.name} không đủ tồn kho.`,
        productId: id,
        available: product.stock,
        requested: quantity,
      });
    }
    const result = await tx.product.updateMany({
      where: { id, version: product.version, stock: { gte: quantity } },
      data: { stock: { decrement: quantity }, version: { increment: 1 } },
    });
    if (result.count !== 1) throw new OptimisticStockConflict();
  }
  return products;
}

export function reservationExpired(order: Order, now = new Date()) {
  return order.reservationStatus === 'HELD' && order.reservationExpiresAt !== null &&
    order.reservationExpiresAt <= now;
}

export function assertReservationActive(order: Order) {
  if (reservationExpired(order) || order.reservationStatus === 'RELEASED') {
    throw new ConflictException('Thời gian giữ hàng đã hết hoặc đơn hàng đã được hủy. Vui lòng đặt lại.');
  }
}

// The caller must hold the order row lock. The surrounding transaction makes
// the stock increments and HELD/CONSUMED -> RELEASED change exactly-once.
export async function releaseStock(tx: Prisma.TransactionClient, order: Order) {
  if (order.reservationStatus !== 'HELD' && order.reservationStatus !== 'CONSUMED') return;
  const items = await tx.orderItem.findMany({
    where: { orderId: order.id },
    select: { productId: true, quantity: true },
  });
  for (const [id, quantity] of aggregateQuantities(items)) {
    await tx.product.update({
      where: { id },
      data: { stock: { increment: quantity }, version: { increment: 1 } },
    });
  }
}
