import Link from 'next/link';
import type { useLoyaltyAccount } from '@/hooks/useLoyaltyAccount';

export default function LoyaltyRedemptionField({ loyalty, points, maxPoints, onChange, appliedPoints, disabled }: {
  loyalty: ReturnType<typeof useLoyaltyAccount>; points: number; maxPoints: number;
  onChange: (points: number) => void; disabled: boolean;
  appliedPoints?: number;
}) {
  const number = new Intl.NumberFormat('vi-VN');
  return (
    <fieldset className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4" disabled={disabled}>
      <legend className="px-1 text-sm font-bold text-coffee-950">✦ Sử dụng điểm thưởng</legend>
      {appliedPoints !== undefined ? (
        <p role="status" className="text-xs leading-relaxed text-coffee-700">
          Đã áp dụng <strong>{number.format(appliedPoints)} điểm</strong> vào đơn hàng. Bạn có thể tiếp tục thanh toán; thử lại sẽ không trừ thêm điểm.
        </p>
      ) : !loyalty.userId ? (
        <p className="text-xs text-coffee-700"><Link href="/login" className="font-bold underline">Đăng nhập</Link> để sử dụng điểm khi đặt hàng.</p>
      ) : loyalty.account ? (
        <>
          <p id="redemption-policy" className="text-xs leading-relaxed text-coffee-700">
            Bạn có <strong>{number.format(loyalty.account.loyaltyPoints)} điểm</strong>. 1 điểm giảm {number.format(loyalty.account.redemptionVndPerPoint)}đ.
          </p>
          <label htmlFor="redeemedPoints" className="mt-3 block text-xs font-semibold text-coffee-800">Số điểm muốn dùng</label>
          <div className="mt-2 flex gap-2">
            <input id="redeemedPoints" type="number" min={0} step={1} inputMode="numeric" value={points || ''}
              aria-describedby="redemption-policy redemption-limit" placeholder="0"
              onChange={(event) => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-coffee-200 bg-white px-3 text-sm text-coffee-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600" />
            <button type="button" disabled={!maxPoints} onClick={() => onChange(maxPoints)}
              className="min-h-11 rounded-xl border border-coffee-200 bg-white px-3 text-xs font-bold text-coffee-800 hover:bg-coffee-50 disabled:opacity-50">Dùng tối đa</button>
          </div>
          <p id="redemption-limit" className="mt-2 text-xs text-coffee-600">Đơn này dùng tối đa {number.format(maxPoints)} điểm, sau mã giảm giá.</p>
          {points > maxPoints && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">Số điểm vượt mức có thể dùng. Vui lòng giảm số điểm hoặc chọn Dùng tối đa.</p>}
          {points > 0 && <button type="button" onClick={() => onChange(0)} className="mt-2 min-h-9 text-xs font-semibold text-coffee-700 underline">Không sử dụng điểm</button>}
        </>
      ) : (
        <div className="text-xs text-coffee-700">
          <p role={loyalty.error ? 'alert' : 'status'}>{loyalty.error || 'Đang tải điểm thưởng...'}</p>
          {loyalty.error && <button type="button" onClick={loyalty.refresh} className="mt-2 min-h-9 font-bold underline">Tải lại số điểm</button>}
          {points > 0 && <button type="button" onClick={() => onChange(0)} className="ml-3 min-h-9 underline">Không sử dụng điểm</button>}
        </div>
      )}
    </fieldset>
  );
}
