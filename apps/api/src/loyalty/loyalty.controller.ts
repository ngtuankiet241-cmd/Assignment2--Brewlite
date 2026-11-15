import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('me')
  getAccount(@CurrentUser() user: JwtPayload) {
    return this.loyalty.getAccount(user.userId);
  }
}
