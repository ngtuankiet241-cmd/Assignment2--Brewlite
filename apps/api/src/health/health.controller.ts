
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      throw new HttpException(
        {
          status: 'error',
          database: 'disconnected',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
