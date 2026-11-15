
import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PromotionsModule } from '../promotions/promotions.module';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    InventoryModule,
    PromotionsModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
