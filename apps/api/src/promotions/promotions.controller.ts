import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PromotionsService, ValidatePromotionDto } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @HttpCode(200)
  validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(dto);
  }
}
