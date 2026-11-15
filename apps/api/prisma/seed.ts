import { DiscountType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const products = [
  {
    name: 'Cà phê sữa',
    description: 'Cà phê phin đậm vị Việt Nam hòa quyện cùng sữa đặc béo ngậy.',
    price: 29000,
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735',
    stock: 50,
  },
  {
    name: 'Trà sữa',
    description: 'Trà đen thơm nhẹ kết hợp sữa tươi và trân châu đen dai mềm.',
    price: 39000,
    imageUrl: 'https://images.unsplash.com/photo-1558857563-c0c6b8b7a1d9',
    stock: 60,
  },
  {
    name: 'Matcha',
    description: 'Bột matcha Nhật Bản hòa cùng sữa tươi, vị thanh ngọt tự nhiên.',
    price: 45000,
    imageUrl: 'https://images.unsplash.com/photo-1536256268855-8f64b7c2b9e7',
    stock: 40,
  },
  {
    name: 'Trà đào cam sả',
    description: 'Trà đào thơm mát kết hợp cam tươi và sả, thêm topping đào giòn.',
    price: 42000,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc',
    stock: 45,
  },
  {
    name: 'Hồng trà',
    description: 'Hồng trà nguyên lá đậm hương, có thể lựa chọn uống truyền thống hoặc thêm sữa.',
    price: 32000,
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3',
    stock: 55,
  },
  {
    name: 'Oreo đá xay',
    description: 'Đá xay mềm mịn vị Oreo cùng kem whipping và vụn bánh giòn rụm.',
    price: 49000,
    imageUrl: 'https://images.unsplash.com/photo-1579954115545-a955e57f8c1f',
    stock: 35,
  },
];

const promotions = [
  { code: 'BREW10', description: 'Giảm 10%, tối đa 20.000đ, cho đơn từ 50.000đ',
    discountType: DiscountType.PERCENTAGE, discountValue: 10, minOrderValue: 50000, maxDiscount: 20000 },
  { code: 'BREW20K', description: 'Giảm 20.000đ cho đơn từ 100.000đ',
    discountType: DiscountType.FIXED_AMOUNT, discountValue: 20000, minOrderValue: 100000 },
];

const drinkSizes = [
  { id: 'S', label: 'Nhỏ', priceAdjustment: -5000, sortOrder: 0 },
  { id: 'M', label: 'Vừa', priceAdjustment: 0, sortOrder: 1 },
  { id: 'L', label: 'Lớn', priceAdjustment: 5000, sortOrder: 2 },
];

const toppings = [
  { id: 'pearls', name: 'Trân châu đen', unitPrice: 7000, sortOrder: 0 },
  { id: 'peach-jelly', name: 'Thạch đào', unitPrice: 8000, sortOrder: 1 },
  { id: 'cheese-foam', name: 'Kem cheese', unitPrice: 10000, sortOrder: 2 },
];

async function main() {
  for (const product of products) {
    const existingProduct = await prisma.product.findFirst({
      where: { name: product.name },
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: { ...product, version: { increment: 1 } },
      });
    } else {
      await prisma.product.create({
        data: product,
      });
    }
  }

  for (const promotion of promotions) {
    await prisma.promotion.upsert({
      where: { code: promotion.code },
      // Preserve any operator changes to validity, caps or activation on reruns.
      update: {},
      create: promotion,
    });
  }

  for (const size of drinkSizes) {
    await prisma.drinkSizeOption.upsert({
      where: { id: size.id },
      update: {},
      create: size,
    });
  }

  for (const topping of toppings) {
    await prisma.toppingOption.upsert({
      where: { id: topping.id },
      update: {},
      create: topping,
    });
  }

  console.log(`Seeded ${products.length} products, ${promotions.length} promotions, and catalog options successfully.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
