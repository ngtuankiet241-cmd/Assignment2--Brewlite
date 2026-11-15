
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RefundsService } from './refunds.service';

type AuthenticatedRequest = {
  user?: {
    id?: string;
    sub?: string;
    userId?: string;
  };
};

@Controller('refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundsController {
  constructor(
    private readonly refundsService: RefundsService,
  ) {}

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

  // Nhân viên và quản lý xem danh sách hoàn tiền.
  @Get()
  @Roles(Role.BARISTA, Role.ADMIN)
  findAll() {
    return this.refundsService.findAll();
  }

  // Nhân viên và quản lý duyệt yêu cầu.
  @Patch(':id/approve')
  @Roles(Role.BARISTA, Role.ADMIN)
  approve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundsService.approve(
      id,
      this.getUserId(req),
    );
  }

  // Nhân viên và quản lý từ chối yêu cầu.
  @Patch(':id/reject')
  @Roles(Role.BARISTA, Role.ADMIN)
  reject(
    @Param('id') id: string,
    @Body('reason') reason: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundsService.reject(
      id,
      this.getUserId(req),
      reason,
    );
  }

  // Nhân viên và quản lý ghi nhận chuyển khoản thật.
  @Patch(':id/transfer')
  @Roles(Role.BARISTA, Role.ADMIN)
  recordTransfer(
    @Param('id') id: string,
    @Body('bankTransactionRef') bankTransactionRef: unknown,
    @Body('evidenceUrl') evidenceUrl: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundsService.recordTransfer(
      id,
      this.getUserId(req),
      bankTransactionRef,
      evidenceUrl,
    );
  }

  // BARISTA hoặc ADMIN xác minh hoàn tiền thật.
  // Người xác minh phải khác người ghi nhận chuyển khoản.
  @Patch(':id/verify')
  @Roles(Role.BARISTA, Role.ADMIN)
  verify(
    @Param('id') id: string,
    @Body('confirmed') confirmed: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundsService.verify(
      id,
      this.getUserId(req),
      confirmed,
    );
  }

  // BARISTA hoặc ADMIN được thử hoàn tiền mô phỏng Sandbox.
  // Không chuyển tiền thật, không gọi API hoàn tiền của SePay.
  @Patch(':id/demo-complete')
  @Roles(Role.BARISTA, Role.ADMIN)
  completeDemo(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundsService.completeDemo(
      id,
      this.getUserId(req),
    );
  }
}
