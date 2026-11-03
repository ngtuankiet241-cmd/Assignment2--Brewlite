
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const product = {
    id: 'p1',
    name: 'Coffee',
    description: 'Milk coffee',
    price: 35000,
    imageUrl: 'coffee.jpg',
    stock: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new ProductsController(
      mockProductsService as unknown as ProductsService,
    );
  });

  it('should return products with standard JSON response', async () => {
    mockProductsService.findAll.mockResolvedValue([product]);

    const result = await controller.findAll();

    expect(result).toEqual({
      success: true,
      message: 'Lấy danh sách sản phẩm thành công',
      data: [product],
    });
  });

  it('should return product details with standard JSON response', async () => {
    mockProductsService.findOne.mockResolvedValue(product);

    const result = await controller.findOne('p1');

    expect(result).toEqual({
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công',
      data: product,
    });

    expect(mockProductsService.findOne).toHaveBeenCalledWith('p1');
  });
});
