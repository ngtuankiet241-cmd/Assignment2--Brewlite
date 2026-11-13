import { NotFoundException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { assertOrderStatus, assertTransition } from './order-state-machine';

// Every status writer locks the same order first, including checkout and IPN.
// The lock remains held until the surrounding interactive transaction commits.
export async function lockOrder(tx: Prisma.TransactionClient, id: string): Promise<Order> {
  const orders = await tx.$queryRaw<Order[]>`
    SELECT * FROM "Order" WHERE "id" = ${id} FOR UPDATE
  `;
  if (!orders[0]) throw new NotFoundException(`Order with id ${id} not found`);
  return orders[0];
}

export async function changeOrderStatus(tx: Prisma.TransactionClient, id: string, status: unknown) {
  assertOrderStatus(status);
  const order = await lockOrder(tx, id);
  assertTransition(order.status, status);
  return tx.order.update({ where: { id }, data: { status } });
}
