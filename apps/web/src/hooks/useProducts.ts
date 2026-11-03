'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductFilterCategory } from '@/types/product';

export type DemoMode = 'normal' | 'loading' | 'empty' | 'error';

interface BackendProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  stock: number;
}

interface BackendResponse {
  success: boolean;
  message: string;
  data: BackendProduct[];
}

/**
 * Helper tự động phân loại category ('traditional' | 'espresso' | 'tea')
 * và categoryName dựa trên từ khóa trong tên món.
 */
export function detectCategory(name: string): {
  category: 'traditional' | 'espresso' | 'tea';
  categoryName: string;
} {
  const lower = (name || '').toLowerCase();

  // Nhóm trà trái cây
  if (lower.includes('trà') || lower.includes('tea')) {
    return {
      category: 'tea',
      categoryName: 'Trà trái cây',
    };
  }

  // Nhóm cà phê pha máy (espresso, latte, cappuccino, americano)
  if (
    lower.includes('espresso') ||
    lower.includes('latte') ||
    lower.includes('cappuccino') ||
    lower.includes('americano')
  ) {
    return {
      category: 'espresso',
      categoryName: 'Cà phê pha máy',
    };
  }

  // Nhóm cà phê truyền thống (cà phê sữa, cà phê đen, bạc xỉu...)
  return {
    category: 'traditional',
    categoryName: 'Cà phê truyền thống',
  };
}

export function useProducts() {
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductFilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [demoMode, setDemoMode] = useState<DemoMode>('normal');
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      // 1. Loading Demo Mode
      if (demoMode === 'loading') {
        await new Promise((res) => setTimeout(res, 100));
        if (!ignore) {
          setError(null);
          setLoading(true);
        }
        return;
      }

      // 2. Error Demo Mode
      if (demoMode === 'error') {
        await new Promise((res) => setTimeout(res, 250));
        if (!ignore) {
          setError('Lỗi kết nối máy chủ: Không thể tải danh sách đồ uống (500 Internal Server Error). Vui lòng thử lại.');
          setLoading(false);
        }
        return;
      }

      // 3. Empty Demo Mode
      if (demoMode === 'empty') {
        await new Promise((res) => setTimeout(res, 200));
        if (!ignore) {
          setRawProducts([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      // 4. Normal Mode: Fetch API thật từ Backend NestJS
      try {
        const res = await fetch(`${apiUrl}/products`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`Máy chủ phản hồi lỗi HTTP ${res.status}: ${res.statusText || 'Yêu cầu không thành công'}`);
        }

        const resJson: BackendResponse = await res.json();

        if (!resJson || !Array.isArray(resJson.data)) {
          throw new Error('Dữ liệu phản hồi từ Backend không đúng cấu trúc { success, data: [] }');
        }

        // Map dữ liệu từ Backend sang model hiển thị Product của Frontend
        const mappedProducts: Product[] = resJson.data.map((item: BackendProduct, index: number) => {
          const { category, categoryName } = detectCategory(item.name);
          return {
            id: String(item.id),
            name: item.name,
            description: item.description,
            price: Number(item.price) || 0,
            imageUrl: item.imageUrl || '/images/products/placeholder.svg',
            category,
            categoryName,
            isAvailable: typeof item.stock === 'number' ? item.stock > 0 : true,
            stock: item.stock,
            rating: 4.8,
            prepTimeMinutes: 3,
            badge: index === 0 ? 'Bán chạy nhất' : undefined,
          };
        });

        if (!ignore) {
          setRawProducts(mappedProducts);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const message =
            err instanceof TypeError && err.message.toLowerCase().includes('fetch')
              ? `Không thể kết nối đến máy chủ Backend tại ${apiUrl}. Vui lòng đảm bảo Backend NestJS đang chạy (port 3001).`
              : err instanceof Error
                ? err.message
                : 'Đã có lỗi xảy ra khi tải danh sách sản phẩm từ máy chủ.';
          setError(message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      ignore = true;
    };
  }, [apiUrl, demoMode, refreshIndex]);

  // Bộ lọc searchQuery (theo tên & mô tả) và selectedCategory (theo category)
  const filteredProducts = useMemo(() => {
    let list = rawProducts;

    // Lọc theo danh mục đã chọn
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Lọc theo từ khóa tìm kiếm (tên hoặc mô tả)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return list;
  }, [rawProducts, selectedCategory, searchQuery]);

  // Thao tác thử lại (Refetch)
  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    if (demoMode === 'error') {
      setDemoMode('normal');
    }
    setRefreshIndex((prev) => prev + 1);
  }, [demoMode]);

  // Thao tác xóa bộ lọc (Reset filters)
  const resetFilters = useCallback(() => {
    setSelectedCategory('all');
    setSearchQuery('');
    setDemoMode('normal');
    setLoading(true);
    setError(null);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Chuyển đổi trạng thái demo phục vụ kiểm thử UI trong môi trường Development
  const handleDemoModeChange = useCallback((mode: DemoMode) => {
    setDemoMode(mode);
    setLoading(true);
    setError(null);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  return {
    products: filteredProducts,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    refetch,
    resetFilters,
    demoMode,
    setDemoMode: handleDemoModeChange,
  };
}
