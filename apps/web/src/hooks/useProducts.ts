'use client';

import { useState, useEffect, useCallback } from 'react';
import { Product, ProductFilterCategory } from '@/types/product';
import { getProducts } from '@/services/productService';

export type DemoMode = 'normal' | 'loading' | 'empty' | 'error';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductFilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [demoMode, setDemoMode] = useState<DemoMode>('normal');
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      // 1. Loading Demo Mode
      if (demoMode === 'loading') {
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
          setProducts([]);
          setError(null);
          setLoading(false);
        }
        return;
      }

      // 4. Normal Mode (Data fetch with filter & search)
      try {
        const data = await getProducts({
          category: selectedCategory,
          search: searchQuery,
        });

        if (!ignore) {
          setProducts(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const message = err instanceof Error ? err.message : 'Đã có lỗi xảy ra khi tải dữ liệu thực đơn';
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
  }, [selectedCategory, searchQuery, demoMode, refreshIndex]);

  // Handle retry action (recovers from error to normal data)
  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    if (demoMode === 'error') {
      setDemoMode('normal');
    }
    setRefreshIndex((prev) => prev + 1);
  }, [demoMode]);

  // Handle filter reset (recovers from empty to all items)
  const resetFilters = useCallback(() => {
    setSelectedCategory('all');
    setSearchQuery('');
    setDemoMode('normal');
    setLoading(true);
    setError(null);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Handle switching demo states (for testing in development)
  const handleDemoModeChange = useCallback((mode: DemoMode) => {
    setDemoMode(mode);
    setLoading(true);
    setError(null);
    setRefreshIndex((prev) => prev + 1);
  }, []);

  return {
    products,
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
