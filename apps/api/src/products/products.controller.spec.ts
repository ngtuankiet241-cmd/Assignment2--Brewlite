
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findConfiguration: jest.fn(),
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

  it('should return product configuration with standard JSON response', async () => {
    const configuration = {
      sizes: [{ id: 'M', label: 'Vừa', priceAdjustment: 0 }],
      toppings: [{ id: 'pearls', name: 'Trân châu đen', unitPrice: 7000 }],
    };
    mockProductsService.findConfiguration.mockResolvedValue(configuration);

    await expect(controller.findConfiguration()).resolves.toEqual({
      success: true,
      message: 'Lấy cấu hình sản phẩm thành công',
      data: configuration,
    });
  });
});
