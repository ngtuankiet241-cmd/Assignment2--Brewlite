import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertTransition } from './order-state-machine';

// Business contract from the supplied diagram, independent of the implementation map.
const allowed: [OrderStatus, OrderStatus][] = [
  ['PENDING', 'PAID'], ['PENDING', 'PAYMENT_FAILED'], ['PENDING', 'CANCELLED'],
  ['PAYMENT_FAILED', 'PENDING'], ['PAYMENT_FAILED', 'CANCELLED'],
  ['PAID', 'PREPARING'], ['PAID', 'CANCELLED'],
  ['PREPARING', 'READY'], ['READY', 'COMPLETED'],
];
const forbidden = Object.values(OrderStatus).flatMap((from) =>
  Object.values(OrderStatus).filter((to) => !allowed.some(([a, b]) => a === from && b === to))
    .map((to) => [from, to] as [OrderStatus, OrderStatus]),
);

describe('Order State Machine', () => {
  it.each(allowed)('UT-SM-01: allows %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(forbidden)('UT-SM-02: blocks %s -> %s, including terminal states and self transitions', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });

  it.each([undefined, null, '', 'SHIPPED', 123, {}, [], true])('UT-SM-03: rejects an invalid target (%#)', (status) => {
    expect(() => assertTransition(OrderStatus.PENDING, status)).toThrow(BadRequestException);
  });
});
