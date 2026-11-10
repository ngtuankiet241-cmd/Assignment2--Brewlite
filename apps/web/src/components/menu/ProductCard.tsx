'use client';

import React from 'react';
import Image from 'next/image';
import { Product } from '@/types/product';
import { formatCurrencyVND } from '@/data/mockProducts';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
}

export default function ProductCard({ product, onViewDetails }: ProductCardProps) {
  const handleViewDetails = () => onViewDetails(product);

  return (
    <article
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-coffee-200/80 bg-white p-3.5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-coffee-300 hover:shadow-md sm:p-4"
      aria-labelledby={`product-title-${product.id}`}
    >
      <div>
        {/* Consistent Image Container */}
        <button
          type="button"
          onClick={handleViewDetails}
          aria-label={`Xem chi tiết đồ uống ${product.name}`}
          aria-haspopup="dialog"
          className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-2xl bg-cream-50/80 text-left transition-colors hover:bg-coffee-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coffee-600"
        >
          <Image
            src={product.imageUrl}
            alt={`Ảnh minh họa ${product.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
            priority={product.id === 'prod-001' || product.id === 'prod-002'}
          />

          {/* Badge Tag */}
          {product.badge && (
            <span className="absolute top-2.5 left-2.5">
              <span className="inline-flex items-center rounded-full bg-coffee-800/90 px-2.5 py-0.5 text-[10px] font-semibold text-cream-50 shadow-xs backdrop-blur-sm">
                {product.badge}
              </span>
            </span>
          )}

          {/* Prep Time & Rating */}
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-coffee-800 shadow-2xs backdrop-blur-sm">
            <span>⭐ {product.rating ?? 4.8}</span>
            <span className="text-coffee-300">•</span>
            <span>{product.prepTimeMinutes ?? 3}p</span>
          </span>
        </button>

        {/* Product Information */}
        <div className="mt-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-coffee-500">
              {product.categoryName}
            </span>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              Sẵn sàng
            </span>
          </div>

          <h3
            id={`product-title-${product.id}`}
            className="text-base font-bold text-coffee-950 transition-colors group-hover:text-coffee-700"
          >
            <button
              type="button"
              onClick={handleViewDetails}
              aria-haspopup="dialog"
              className="line-clamp-1 w-full cursor-pointer rounded-sm text-left transition-colors hover:text-coffee-600 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coffee-600"
            >
              {product.name}
            </button>
          </h3>

          <p className="line-clamp-2 text-xs leading-relaxed text-coffee-700/80">
            {product.description}
          </p>
        </div>
      </div>

      {/* Footer: Price & Mobile-first Tap Button (44px min height) */}
      <div className="mt-4 pt-3 border-t border-coffee-100 flex items-center justify-between gap-2">
        <div className="flex flex-col shrink-0">
          <span className="text-[10px] uppercase font-semibold text-coffee-400">Giá</span>
          <span className="text-sm sm:text-base font-extrabold text-coffee-900">
            {formatCurrencyVND(product.price)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleViewDetails}
          aria-haspopup="dialog"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-coffee-200 bg-cream-50 px-3.5 py-2 text-xs font-semibold text-coffee-800 transition duration-200 hover:border-coffee-700 hover:bg-coffee-800 hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600"
          aria-label={`Xem chi tiết đồ uống ${product.name}`}
        >
          <span>Chi tiết</span>
          <svg
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </article>
  );
}
