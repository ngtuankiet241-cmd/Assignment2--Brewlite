import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorState({
  message = 'Không thể tải danh sách đồ uống lúc này. Vui lòng kiểm tra lại kết nối và thử lại.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="my-8 flex flex-col items-center justify-center rounded-3xl border border-red-200 bg-red-50/70 p-8 text-center sm:p-12 shadow-xs"
    >
      {/* Error icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 shadow-xs">
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h3 className="mt-4 text-lg font-bold text-red-950 sm:text-xl">
        Không thể tải thực đơn đồ uống
      </h3>

      <p className="mt-2 max-w-md text-xs leading-relaxed text-red-800/90 sm:text-sm">
        {message}
      </p>

      {/* Retry Button */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-coffee-800 px-6 py-2.5 text-xs font-bold text-cream-50 shadow-sm transition hover:bg-coffee-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Thử lại</span>
        </button>
      </div>
    </div>
  );
}
