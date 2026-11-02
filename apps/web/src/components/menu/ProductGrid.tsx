'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Product, ProductFilterCategory } from '@/types/product';
import ProductCard from './ProductCard';
import { ProductGridSkeleton } from './ProductCardSkeleton';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import { formatCurrencyVND } from '@/data/mockProducts';
import { DemoMode } from '@/hooks/useProducts';

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
    { key: 'tea', label: 'Trà trái cây', icon: '🍑' },
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
            role="tablist"
            aria-label="Bộ lọc danh mục đồ uống"
          >
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  onClick={() => onSelectCategory(cat.key)}
                  className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 ${
                    isActive
                      ? 'bg-coffee-800 text-cream-50 shadow-xs'
                      : 'border border-coffee-200/80 bg-white text-coffee-800 hover:bg-coffee-50'
                  }`}
                  aria-selected={isActive}
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

      {/* Product Detail Modal */}
      {activeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-product-title"
          onClick={() => setActiveProduct(null)}
        >
          <div
            className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-coffee-100 p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveProduct(null)}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-coffee-900 shadow-xs backdrop-blur-xs transition hover:bg-coffee-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-500"
              aria-label="Đóng cửa sổ chi tiết"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Body */}
            <div>
              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-3.5">
                <div className="relative h-32 w-32 sm:h-36 sm:w-36 shrink-0 overflow-hidden rounded-2xl bg-cream-50">
                  <Image
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    fill
                    sizes="150px"
                    className="object-contain p-2"
                  />
                  {activeProduct.badge && (
                    <span className="absolute top-2 left-2 rounded-full bg-coffee-800 px-2 py-0.5 text-[9px] font-semibold text-cream-50">
                      {activeProduct.badge}
                    </span>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-coffee-500">
                    {activeProduct.categoryName}
                  </span>
                  <h3
                    id="modal-product-title"
                    className="text-base font-bold text-coffee-950 sm:text-xl break-words"
                  >
                    {activeProduct.name}
                  </h3>
                  <p className="mt-0.5 text-base font-extrabold text-coffee-800">
                    {formatCurrencyVND(activeProduct.price)}
                  </p>

                  <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 text-xs text-coffee-600">
                    <span>⭐ <strong>{activeProduct.rating ?? 4.8}</strong></span>
                    <span>•</span>
                    <span>⏱️ <strong>{activeProduct.prepTimeMinutes ?? 3}p</strong> chuẩn bị</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mt-3.5 border-t border-coffee-100 pt-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-coffee-400">
                  Mô tả hương vị
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-coffee-800 break-words">
                  {activeProduct.description}
                </p>
              </div>

              {/* Sprint 1 Scope Notice */}
              <div className="mt-3.5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">ℹ️</span>
                  <div>
                    <strong className="font-semibold">Phạm vi Sprint 1 (Task 4.3):</strong>
                    <p className="mt-0.5 text-[11px] text-amber-800 leading-snug">
                      Tính năng tùy chỉnh size/đường/đá và thanh toán không tiền mặt sẽ được phát triển trong <strong>Sprint 2</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="w-full sm:w-auto min-h-[44px] rounded-full border border-coffee-300 px-5 py-2 text-xs font-semibold text-coffee-800 transition hover:bg-coffee-50 active:scale-95"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-200 px-5 py-2 text-xs font-semibold text-zinc-500 cursor-not-allowed"
                  title="Tính năng đặt món sẽ có trong Sprint 2"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>Thêm vào giỏ (Sprint 2)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
