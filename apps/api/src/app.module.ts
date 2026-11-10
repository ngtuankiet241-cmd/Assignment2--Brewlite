
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [PrismaModule, ProductsModule, HealthModule],
})
export class AppModule {}
