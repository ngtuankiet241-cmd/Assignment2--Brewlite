'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductCategory, ProductFilterCategory } from '@/types/product';
import { parseProductsResponse, type BackendProduct } from '@/lib/productResponse';

export type DemoMode = 'normal' | 'loading' | 'empty' | 'error';

export function detectCategory(name: string): {
  category: ProductCategory;
  categoryName: string;
} {
  const lower = (name || '').toLowerCase();

  if (lower.includes('đá xay') || lower.includes('frapp')) {
    return {
      category: 'blended',
      categoryName: 'Đá xay',
    };
  }

  if (
    lower.includes('trà sữa') ||
    lower.includes('milk tea') ||
    lower.includes('bubble tea') ||
    lower.includes('boba')
  ) {
    return {
      category: 'milk-tea',
      categoryName: 'Trà sữa',
    };
  }

  if (lower.includes('trà') || lower.includes('tea')) {
    return {
      category: 'tea',
      categoryName: 'Trà trái cây',
    };
  }

  if (lower.includes('matcha')) {
    return {
      category: 'specialty',
      categoryName: 'Thức uống đặc biệt',
    };
  }

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

  const activeDemoMode = process.env.NODE_ENV === 'development' ? demoMode : 'normal';

  useEffect(() => {
    // Simulated states are derived below and never make a network request.
    if (activeDemoMode !== 'normal') return;

    let ignore = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    async function loadProducts() {
      try {
        const res = await fetch('/api/products', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(res.status === 504 || res.status === 408
            ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
            : `Không thể tải thực đơn (HTTP ${res.status}). Vui lòng thử lại.`);
        }

        const resJson: unknown = await res.json();
        const rawList = parseProductsResponse(resJson);

        const mappedProducts: Product[] = rawList.map((item: BackendProduct, index: number) => {
          const { category, categoryName } = detectCategory(item.name);
          const hasValidImage =
            typeof item.imageUrl === 'string' &&
            (item.imageUrl.startsWith('http://') ||
              item.imageUrl.startsWith('https://') ||
              item.imageUrl.startsWith('/'));

          const safeImageUrl = hasValidImage
            ? item.imageUrl
            : category === 'tea'
              ? '/images/products/tra-dao.svg'
              : category === 'espresso'
                ? '/images/products/americano.svg'
                : '/images/products/ca-phe-sua.svg';

          return {
            id: String(item.id),
            name: item.name,
            description: item.description,
            price: Number(item.price) || 0,
            imageUrl: safeImageUrl,
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
      } catch (cause) {
        if (!ignore) {
          setRawProducts([]);
          setError(controller.signal.aborted
            ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
            : cause instanceof Error
              ? cause.message
              : 'Không thể tải thực đơn. Vui lòng kiểm tra kết nối và thử lại.');
        }
      } finally {
        clearTimeout(timeout);
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      ignore = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [activeDemoMode, refreshIndex]);

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
    setDemoMode('normal');
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Thao tác xóa bộ lọc (Reset filters)
  const resetFilters = useCallback(() => {
    setSelectedCategory('all');
    setSearchQuery('');
  }, []);

  // Chuyển đổi trạng thái demo phục vụ kiểm thử UI trong môi trường Development
  const handleDemoModeChange = useCallback((mode: DemoMode) => {
    if (process.env.NODE_ENV !== 'development') return;
    setDemoMode(mode);
    setLoading(true);
    setError(null);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  return {
    products: activeDemoMode === 'normal' ? filteredProducts : [],
    isCatalogEmpty: activeDemoMode === 'empty' || rawProducts.length === 0,
    loading: activeDemoMode === 'loading' || (activeDemoMode === 'normal' && loading),
    error: activeDemoMode === 'error'
      ? 'Lỗi kết nối máy chủ mô phỏng (HTTP 500). Vui lòng thử lại.'
      : activeDemoMode === 'normal' ? error : null,
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
