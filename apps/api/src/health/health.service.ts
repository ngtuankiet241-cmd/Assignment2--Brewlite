import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const HEALTH_CHECK_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: 'ok'; database: 'up' }> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Database health check timed out')),
          HEALTH_CHECK_TIMEOUT_MS,
        );
      });

      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);

      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
