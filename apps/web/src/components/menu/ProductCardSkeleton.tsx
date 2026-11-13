import React from 'react';

export default function ProductCardSkeleton() {
  return (
    <div
      className="flex flex-col justify-between overflow-hidden rounded-3xl border border-coffee-200/50 bg-white p-3.5 shadow-xs sm:p-4"
      aria-hidden="true"
    >
      <div>
        {/* Image skeleton with consistent aspect-square */}
        <div className="relative aspect-square w-full animate-pulse rounded-2xl bg-coffee-100/70" />

        {/* Info skeleton */}
        <div className="mt-3.5 space-y-1">
          {/* Category pill skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-3 w-20 animate-pulse rounded-md bg-coffee-200/60" />
            <div className="h-3 w-12 animate-pulse rounded-md bg-coffee-100" />
          </div>

          {/* Title skeleton */}
          <div className="h-6 w-3/4 animate-pulse rounded-md bg-coffee-200/70" />

          {/* Description lines skeleton */}
          <div className="h-8 space-y-1.5 pt-1">
            <div className="h-3 w-full animate-pulse rounded bg-coffee-100/80" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-coffee-100/60" />
          </div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-coffee-100 pt-3">
        <div className="space-y-1">
          <div className="h-2.5 w-12 animate-pulse rounded bg-coffee-100" />
          <div className="h-5 w-16 animate-pulse rounded-md bg-coffee-200/80" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-full bg-coffee-200/70" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Đang tải thực đơn đồ uống..."
      className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-5"
    >
      <span className="sr-only">Đang tải danh sách đồ uống...</span>
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
