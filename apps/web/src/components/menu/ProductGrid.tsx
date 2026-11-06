'use client';

import React, { useState } from 'react';
import { Product, ProductFilterCategory } from '@/types/product';
import ProductCard from './ProductCard';
import { ProductGridSkeleton } from './ProductCardSkeleton';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import { DemoMode } from '@/hooks/useProducts';
import ProductConfigurator from './ProductConfigurator';

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  selectedCategory: ProductFilterCategory;
  onSelectCategory: (category: ProductFilterCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRetry: () => void;
  onResetFilters: () => void;
  demoMode: DemoMode;
  onDemoModeChange: (mode: DemoMode) => void;
}

export default function ProductGrid({
  products,
  loading,
  error,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onRetry,
  onResetFilters,
  demoMode,
  onDemoModeChange,
}: ProductGridProps) {
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const categories: { key: ProductFilterCategory; label: string; icon: string }[] = [
    { key: 'all', label: 'Tất cả', icon: '✨' },
    { key: 'traditional', label: 'Cà phê truyền thống', icon: '☕' },
    { key: 'espresso', label: 'Cà phê pha máy', icon: '⚡' },
    { key: 'milk-tea', label: 'Trà sữa', icon: '🧋' },
    { key: 'tea', label: 'Trà trái cây', icon: '🍑' },
    { key: 'blended', label: 'Đá xay', icon: '🥤' },
    { key: 'specialty', label: 'Món đặc biệt', icon: '🌿' },
  ];

  const hasActiveFilters = selectedCategory !== 'all' || searchQuery.trim() !== '';

  return (
    <section id="menu" className="w-full pb-16" aria-labelledby="menu-heading">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Section Heading & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-coffee-200/80 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-coffee-800 text-cream-100 text-xs font-bold shrink-0">
                ☕
              </span>
              <h2
                id="menu-heading"
                className="text-lg font-black tracking-tight text-coffee-950 sm:text-2xl"
              >
                Thực Đơn Đồ Uống
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-coffee-700/80 sm:text-sm">
              Chọn đồ uống yêu thích – Pha chế nhanh tại quầy Pick-up Campus.
            </p>
          </div>

          {/* Search Input (Accessible & Touch-friendly) */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm tên món đồ uống..."
              className="w-full min-h-[44px] rounded-full border border-coffee-200 bg-white px-4 py-2 pl-9 text-xs text-coffee-900 placeholder:text-coffee-400 focus:border-coffee-600 focus:outline-none focus:ring-2 focus:ring-coffee-500/20 shadow-2xs"
              aria-label="Tìm kiếm đồ uống"
            />
            <svg
              className="absolute left-3 top-3.5 h-4 w-4 text-coffee-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-3 h-5 w-5 rounded-full bg-coffee-100 text-coffee-600 text-[10px] flex items-center justify-center transition hover:bg-coffee-200"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filters (Mobile-first horizontal scroll with no unwanted scrollbar) */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar sm:flex-wrap w-full"
            role="group"
            aria-label="Bộ lọc danh mục đồ uống"
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => onSelectCategory(cat.key)}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 ${
                    isActive
                      ? 'bg-coffee-800 text-cream-50 shadow-xs'
                      : 'border border-coffee-200/80 bg-white text-coffee-800 hover:bg-coffee-50'
                  }`}
                  aria-pressed={isActive}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Demo State Switcher (Rendered strictly in Development environment) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50/90 p-2.5 text-xs text-amber-950 border border-amber-200 shadow-2xs">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="font-semibold">Mô phỏng trạng thái (Dev Only):</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'normal', label: 'Bình thường' },
                  { id: 'loading', label: 'Loading' },
                  { id: 'empty', label: 'Empty' },
                  { id: 'error', label: 'Error' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onDemoModeChange(item.id)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
                    demoMode === item.id
                      ? 'bg-coffee-800 text-white shadow-2xs'
                      : 'bg-white text-coffee-800 border border-coffee-200 hover:bg-cream-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results Count Summary */}
        {!loading && !error && (
          <div className="mt-3 flex items-center justify-between text-xs text-coffee-600">
            <span>
              Hiển thị <strong className="text-coffee-950">{products.length}</strong> món đồ uống
              {hasActiveFilters && ' (đã lọc)'}
            </span>
            <span className="hidden sm:inline-block text-[11px] text-coffee-400">
              Đơn giá đã bao gồm VAT
            </span>
          </div>
        )}

        {/* Main Content Area (Handling Loading, Error, Empty, and Responsive Grid) */}
        <div className="mt-3 sm:mt-4">
          {/* 1. Loading State */}
          {loading && <ProductGridSkeleton count={8} />}

          {/* 2. Error State with Retry Button */}
          {!loading && error && <ErrorState message={error} onRetry={onRetry} />}

          {/* 3. Empty State with Reset Filters Button */}
          {!loading && !error && products.length === 0 && (
            <EmptyState
              hasFilters={hasActiveFilters}
              onResetFilters={onResetFilters}
            />
          )}

          {/* 4. Success Grid (1 col on 320px/375px/390px, 2-3 on 768px, 4 on 1440px) */}
          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-5">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={(item) => setActiveProduct(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {activeProduct && (
        <ProductConfigurator
          onClose={() => setActiveProduct(null)}
          product={activeProduct}
        />
      )}
    </section>
  );
}
