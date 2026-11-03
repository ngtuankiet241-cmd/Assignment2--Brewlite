import { Product } from '@/types/product';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    name: 'Cà phê sữa',
    description: 'Cà phê Robusta Đắk Lắk đậm đà hòa quyện cùng sữa đặc béo ngậy truyền thống, mang lại năng lượng sảng khoái cho ngày dài học tập.',
    price: 25000,
    imageUrl: '/images/products/ca-phe-sua.svg',
    category: 'traditional',
    categoryName: 'Cà phê truyền thống',
    badge: 'Bán chạy nhất',
    rating: 4.9,
    prepTimeMinutes: 3,
    isAvailable: true,
  },
  {
    id: 'prod-002',
    name: 'Cà phê đen',
    description: 'Vị đắng nguyên bản từ hạt cà phê Robusta rang mộc hảo hạng, chuẩn gu truyền thống cho buổi sáng tập trung cao độ.',
    price: 22000,
    imageUrl: '/images/products/ca-phe-den.svg',
    category: 'traditional',
    categoryName: 'Cà phê truyền thống',
    badge: 'Đậm vị chuẩn gu',
    rating: 4.8,
    prepTimeMinutes: 2,
    isAvailable: true,
  },
  {
    id: 'prod-003',
    name: 'Bạc xỉu',
    description: 'Sự hòa quyện 3 tầng ngọt ngào từ sữa tươi, sữa đặc và một chút cà phê nhẹ nhàng - lựa chọn hoàn hảo được Gen Z yêu thích nhất.',
    price: 28000,
    imageUrl: '/images/products/bac-xiu.svg',
    category: 'traditional',
    categoryName: 'Cà phê truyền thống',
    badge: 'Gen Z yêu thích',
    rating: 4.95,
    prepTimeMinutes: 3,
    isAvailable: true,
  },
  {
    id: 'prod-004',
    name: 'Cappuccino',
    description: 'Espresso chuẩn vị Ý hòa quyện cùng lớp bọt sữa mềm mịn bồng bềnh, rắc nhẹ chút bột cacao thơm lừng quyến rũ.',
    price: 39000,
    imageUrl: '/images/products/cappuccino.svg',
    category: 'espresso',
    categoryName: 'Cà phê pha máy',
    badge: 'Chuẩn phong cách Ý',
    rating: 4.7,
    prepTimeMinutes: 4,
    isAvailable: true,
  },
  {
    id: 'prod-005',
    name: 'Americano',
    description: 'Shot Espresso kép đậm đà làm dịu cùng nước tinh khiết, hương thơm nồng nàn thanh nhẹ, lựa chọn healthy cho cả ngày.',
    price: 32000,
    imageUrl: '/images/products/americano.svg',
    category: 'espresso',
    categoryName: 'Cà phê pha máy',
    badge: 'Healthy & Thanh nhẹ',
    rating: 4.75,
    prepTimeMinutes: 2,
    isAvailable: true,
  },
  {
    id: 'prod-006',
    name: 'Trà đào',
    description: 'Trà đen thanh mát kết hợp cùng những miếng đào tươi giòn ngọt sần sật và hương sả dịu mát, giải nhiệt tức thì trong giờ giải lao.',
    price: 35000,
    imageUrl: '/images/products/tra-dao.svg',
    category: 'tea',
    categoryName: 'Trà trái cây',
    badge: 'Giải nhiệt sảng khoái',
    rating: 4.85,
    prepTimeMinutes: 3,
    isAvailable: true,
  },
];

/**
 * Helper to format price in VND (e.g. 25.000 ₫)
 */
export function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}
