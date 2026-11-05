import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HEALTH_CHECK_TIMEOUT_MS, HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(() => {
    jest.useFakeTimers();
    prisma.$queryRaw.mockReset();
    service = new HealthService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('UT-HEALTH-01: reports database errors without exposing connection details', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('Connection refused: postgresql://user:secret@db:5432/brewlite'),
    );

    const check = service.check();

    await expect(check).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(check).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', database: 'down' },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('UT-HEALTH-01: times out when the database does not respond', async () => {
    prisma.$queryRaw.mockReturnValue(new Promise(() => {}));

    // Attach the rejection assertion before advancing time to avoid an
    // unhandled rejection when the health-check timeout fires.
    const check = expect(service.check()).rejects.toMatchObject({
      status: 503,
      response: { status: 'error', database: 'down' },
    });

    await jest.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
    await check;
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
