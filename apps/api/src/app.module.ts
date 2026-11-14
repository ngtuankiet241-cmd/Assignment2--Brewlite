import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    HealthModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    AuthModule,
    StaffModule,
  ],
})
export class AppModule {}

