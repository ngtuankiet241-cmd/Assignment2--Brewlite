import { Product, ProductCategory } from '@/types/product';
import { MOCK_PRODUCTS } from '@/data/mockProducts';

export interface FetchProductsOptions {
  category?: ProductCategory | 'all';
  search?: string;
  simulateError?: boolean;
}

/**
 * Product Data Service for BrewLite
 *
 * Designed for Task 4.3 (MVP Sprint 1).
 * Uses mock data with async delay to emulate real HTTP requests.
 *
 * For Luân in next step:
 * Simply replace the internal logic with:
 *   const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`);
 *   if (!res.ok) throw new Error('Failed to fetch products');
 *   return res.json();
 */
export async function getProducts(options?: FetchProductsOptions): Promise<Product[]> {
  // Simulate async network latency
  await new Promise((resolve) => setTimeout(resolve, 400));

  if (options?.simulateError) {
    throw new Error('Lỗi kết nối máy chủ: Không thể tải danh sách thực đơn. Vui lòng thử lại sau.');
  }

  let results = [...MOCK_PRODUCTS];

  if (options?.category && options.category !== 'all') {
    results = results.filter((p) => p.category === options.category);
  }

  if (options?.search && options.search.trim() !== '') {
    const query = options.search.toLowerCase().trim();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.categoryName.toLowerCase().includes(query)
    );
  }

  return results;
}

/**
 * Fetch single product by id.
 * Ready for GET /products/:id
 */
export async function getProductById(id: string): Promise<Product | null> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const item = MOCK_PRODUCTS.find((p) => p.id === id);
  return item || null;
}

