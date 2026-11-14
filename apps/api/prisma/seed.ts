import { PrismaClient } from '@prisma/client';

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

  console.log(`Seeded ${products.length} products successfully.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed products:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
