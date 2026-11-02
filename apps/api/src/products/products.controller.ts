
import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService } from './products.service';
import {
  ApiResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
  ) {}

  @Get()
  async findAll(): Promise<ApiResponseDto<ProductResponseDto[]>> {
    const products = await this.productsService.findAll();

    return {
      success: true,
      message: 'Lấy danh sách sản phẩm thành công',
      data: products,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<ApiResponseDto<ProductResponseDto>> {
    const product = await this.productsService.findOne(id);

    return {
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công',
      data: product,
    };
  }
}
