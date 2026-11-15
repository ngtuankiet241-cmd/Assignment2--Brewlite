'use client';

interface PromotionCodeFieldProps {
  code: string;
  appliedCode?: string;
  applying: boolean;
  disabled: boolean;
  error?: string;
  notice?: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
}

export default function PromotionCodeField({
  code, appliedCode, applying, disabled, error, notice, onCodeChange, onApply, onRemove,
}: PromotionCodeFieldProps) {
  return (
    <section aria-label="Mã giảm giá" className="border-t border-coffee-200/70 pt-4">
      <label className="flex items-center gap-2 text-sm font-bold text-coffee-950" htmlFor="promotionCode">
        <svg aria-hidden="true" className="h-4 w-4 text-coffee-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5h11v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5h5Zm0 0v2m0 3v4m0 3v2" />
        </svg>
        Mã giảm giá
      </label>
      <p className="mt-1 text-xs text-coffee-500" id="promotion-help">Nhập mã ưu đãi cho đơn hàng của bạn.</p>
      <div className="mt-3 flex gap-2">
        <input
          aria-describedby={error ? 'promotion-help promotion-error' : 'promotion-help promotion-status'}
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-coffee-200 bg-cream-50/50 px-3 text-sm font-semibold text-coffee-950 placeholder:font-normal placeholder:text-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden disabled:opacity-60"
          disabled={disabled}
          id="promotionCode"
          name="promotionCode"
          onChange={(event) => onCodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (!disabled && !applying && !appliedCode) onApply();
            }
          }}
          placeholder="Nhập mã giảm giá"
          spellCheck={false}
          type="text"
          value={code}
        />
        <button
          aria-busy={applying}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-coffee-800 px-3 text-xs font-bold text-white transition hover:bg-coffee-700 disabled:opacity-50"
          disabled={disabled || applying || !!appliedCode || !code.trim()}
          onClick={onApply}
          type="button"
        >
          {applying && <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
          {applying ? 'Đang kiểm tra' : appliedCode ? 'Đã áp dụng' : 'Áp dụng'}
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-xs leading-relaxed text-red-700" id="promotion-error" role="alert">{error}</p>
      ) : (
        <div aria-live="polite" id="promotion-status" role="status">
          {appliedCode ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="min-w-0 break-words text-xs font-semibold text-emerald-800">Đã áp dụng mã {appliedCode}</p>
              <button
                aria-label={`Gỡ mã ${appliedCode}`}
                className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-bold text-emerald-800 underline underline-offset-2 hover:bg-emerald-100 disabled:opacity-50"
                disabled={disabled}
                onClick={onRemove}
                type="button"
              >
                Gỡ mã
              </button>
            </div>
          ) : notice ? (
            <p className="mt-2 text-xs leading-relaxed text-coffee-600">{notice}</p>
          ) : null}
        </div>
      )}
      {!appliedCode && code && (
        <button className="mt-1 min-h-9 text-xs font-semibold text-coffee-600 underline underline-offset-2 disabled:opacity-50" disabled={disabled} onClick={onRemove} type="button">
          Xóa mã
        </button>
      )}
    </section>
  );
}
