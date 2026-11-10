import { Controller, Post, Get, Patch, Body, Param, Query } from '@nestjs/common';
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
  updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.ordersService.updateStatus(id, status);
  }
}
