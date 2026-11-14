import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StaffOrdersQuery, StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BARISTA, Role.ADMIN)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get(['', 'orders'])
  getOrders(@Query() query: StaffOrdersQuery) {
    return this.staffService.getOrders(query);
  }

  @Get('orders/:id')
  getOrder(@Param('id') id: string) {
    return this.staffService.getOrder(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body('status') status: unknown) {
    return this.staffService.updateOrderStatus(id, status);
  }
}
