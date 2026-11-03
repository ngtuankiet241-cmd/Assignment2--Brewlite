import React from 'react';

interface EmptyStateProps {
  hasFilters: boolean;
  onResetFilters: () => void;
}

export default function EmptyState({ hasFilters, onResetFilters }: EmptyStateProps) {
  return (
    <div
      role="status"
      className="my-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-coffee-300 bg-white/70 p-8 text-center sm:p-12 shadow-2xs"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-100 text-2xl shadow-2xs">
        ☕
      </div>

      <h3 className="mt-4 text-lg font-bold text-coffee-950 sm:text-xl">
        Chưa tìm thấy đồ uống phù hợp
      </h3>

      <p className="mt-2 max-w-sm text-xs leading-relaxed text-coffee-700/80 sm:text-sm">
        {hasFilters
          ? 'Không có món nào khớp với bộ lọc hoặc từ khóa tìm kiếm của bạn. Hãy thử chọn danh mục khác.'
          : 'Hiện tại thực đơn chưa có món nào sẵn sàng phục vụ. Vui lòng quay lại sau!'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full border border-coffee-300 bg-white px-5 py-2.5 text-xs font-semibold text-coffee-900 shadow-2xs transition hover:bg-coffee-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-500"
        >
          <span>Xem lại tất cả đồ uống</span>
        </button>
      )}
    </div>
  );
}
