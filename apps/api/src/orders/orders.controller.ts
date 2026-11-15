
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';

import { Role } from '@prisma/client';
import { OrdersService, CreateOrderDto } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
  };
};

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private getUserId(req: AuthenticatedRequest): string {
    const userId =
      req.user?.id ??
      req.user?.userId ??
      req.user?.sub;

    if (!userId) {
      throw new UnauthorizedException(
        'Không xác định được tài khoản đăng nhập.',
      );
    }

    return userId;
  }

  // Khách hàng tạo đơn
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.create(dto, this.getUserId(req));
  }

  // Nhân viên xem tất cả đơn
  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA, Role.ADMIN)
  getStaffOrders() {
    return this.ordersService.getStaffOrders();
  }

  // Khách xem lịch sử đơn của mình
  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@Req() req: AuthenticatedRequest) {
    return this.ordersService.getHistory(this.getUserId(req));
  }

  // Khách xem trạng thái đơn
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.ordersService.getStatus(id);
  }

  // Nhân viên xác nhận đơn
  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA, Role.ADMIN)
  confirmOrder(@Param('id') id: string) {
    return this.ordersService.confirmOrder(id);
  }

  // Nhân viên cập nhật trạng thái
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA, Role.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: unknown,
  ) {
    return this.ordersService.updateStatus(id, status);
  }

  // Nhân viên từ chối đơn chưa thanh toán
  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BARISTA, Role.ADMIN)
  rejectOrder(@Param('id') id: string) {
    return this.ordersService.rejectOrder(id);
  }

  // Khách yêu cầu hoàn tiền
  @Post(':id/request-refund')
  @UseGuards(JwtAuthGuard)
  requestRefund(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.requestRefund(
      id,
      this.getUserId(req),
    );
  }

  // Khách kiểm tra trạng thái hoàn tiền
  @Get(':id/refund')
  @UseGuards(JwtAuthGuard)
  getRefund(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ordersService.getRefund(
      id,
      this.getUserId(req),
    );
  }
}
