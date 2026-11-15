
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RefundsModule } from './refunds/refunds.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    OrdersModule,
    PaymentsModule,
    UsersModule,
    AuthModule,
    RefundsModule,
    StaffModule,
  ],
})
export class AppModule {}
