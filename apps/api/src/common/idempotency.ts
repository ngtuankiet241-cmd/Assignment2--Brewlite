import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

export function resolveIdempotencyKey(...values: unknown[]): string | undefined {
  const keys = values.filter((value) => value !== undefined);
  if (keys.some((key) => typeof key !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(key))) {
    throw new BadRequestException('Idempotency-Key phải gồm 1–255 ký tự ASCII không chứa khoảng trắng.');
  }
  if (new Set(keys).size > 1) {
    throw new BadRequestException('Các Idempotency-Key trong header và body phải giống nhau.');
  }
  return keys[0] as string | undefined;
}

// JSON object property order is not part of a request's meaning. Array order is.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export async function withIdempotency<T>(
  tx: Prisma.TransactionClient,
  scope: string,
  key: string | undefined,
  request: unknown,
  work: () => Promise<T>,
  replay?: (response: T) => Promise<T>,
): Promise<T> {
  key = resolveIdempotencyKey(key);
  if (key === undefined) return work();

  const requestHash = createHash('sha256').update(JSON.stringify(canonicalize(request))).digest('hex');
  // The transaction owns this lock, across processes too. Cast PostgreSQL void
  // to text so Prisma can deserialize the advisory-lock query's result.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))::text`;
  const existing = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ConflictException('Idempotency-Key đã được sử dụng cho một yêu cầu khác.');
    }
    const response = existing.response as unknown as T;
    return replay ? replay(response) : response;
  }

  const response = await work();
  // Persist only successful results, atomically with the order/payment and stock.
  await tx.idempotencyRecord.create({
    data: { scope, key, requestHash, response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue },
  });
  return response;
}
