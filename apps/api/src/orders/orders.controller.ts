import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrdersService, CreateOrderDto } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.ordersService.getStatus(id);
  }

  @Get('history')
  getHistory(@Query('userId') userId?: string) {
    return this.ordersService.getHistory(userId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA, Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body('status') status: unknown) {
    return this.ordersService.updateStatus(id, status);
  }
}

