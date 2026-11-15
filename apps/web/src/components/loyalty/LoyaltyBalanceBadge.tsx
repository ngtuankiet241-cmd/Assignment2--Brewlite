import type { useLoyaltyAccount } from '@/hooks/useLoyaltyAccount';

export default function LoyaltyBalanceBadge({ loyalty, compact = false }: {
  loyalty: ReturnType<typeof useLoyaltyAccount>; compact?: boolean;
}) {
  if (!loyalty.userId) return null;
  const points = loyalty.account ? new Intl.NumberFormat('vi-VN').format(loyalty.account.loyaltyPoints) : null;
  const label = points !== null ? `Điểm thưởng hiện có: ${points} điểm` : loyalty.error || 'Đang tải điểm thưởng';
  return (
    <button type="button" aria-label={label} title={`${label}. Bấm để cập nhật.`} onClick={loyalty.refresh}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 font-bold text-coffee-800 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 focus-visible:ring-offset-2 ${compact ? 'max-w-24 px-2.5 text-xs' : 'px-3 text-sm'}`}>
      <span aria-hidden="true" className="shrink-0 text-amber-600">✦</span>
      <span className="truncate">{points !== null ? `${points} điểm` : loyalty.error ? 'Thử lại' : '...'}</span>
    </button>
  );
}
