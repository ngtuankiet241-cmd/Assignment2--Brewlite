'use client';

import React from 'react';
import Header from '@/components/layout/Header';
import ProductGrid from '@/components/menu/ProductGrid';
import { useProducts } from '@/hooks/useProducts';

export default function MenuPageClient() {
  const {
    products,
    isCatalogEmpty,
    loading,
    error,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    refetch,
    resetFilters,
    demoMode,
    setDemoMode,
  } = useProducts();

  return (
    <div className="flex min-h-screen flex-col bg-cream-100 text-coffee-950 max-w-[100vw] overflow-x-hidden selection:bg-coffee-200 selection:text-coffee-950">
      {/* Brand Header */}
      <Header />

      <main className="flex-1 pt-4 sm:pt-6">
        {/* Core Product Menu with Loading, Error, Empty & Success States */}
        <ProductGrid
          products={products}
          isCatalogEmpty={isCatalogEmpty}
          loading={loading}
          error={error}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRetry={refetch}
          onResetFilters={resetFilters}
          demoMode={demoMode}
          onDemoModeChange={setDemoMode}
        />
      </main>
    </div>
  );
}
