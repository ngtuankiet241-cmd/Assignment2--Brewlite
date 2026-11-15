import type { LoyaltyAccount } from '@/lib/loyalty';

const number = new Intl.NumberFormat('vi-VN');
const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function LoyaltyCard({ account }: { account: LoyaltyAccount }) {
  return (
    <div>
      <p className="text-3xl font-black text-coffee-950">
        <output aria-label="Số dư điểm thưởng">{number.format(account.loyaltyPoints)}</output>
        <span className="ml-2 text-sm font-semibold">điểm</span>
      </p>
      <p className="mt-2 text-xs text-coffee-600">
        Mỗi {number.format(account.vndPerPoint)}đ thanh toán sau giảm giá nhận 1 điểm, làm tròn xuống.
        Điểm được cộng khi đơn được xác nhận đã thanh toán.
      </p>
      {account.transactions.length === 0 ? (
        <p className="mt-4 text-sm text-coffee-600">Chưa có lịch sử điểm thưởng.</p>
      ) : (
        <ul aria-label="Lịch sử điểm thưởng gần đây" className="mt-4 divide-y divide-coffee-100">
          {account.transactions.map((entry) => (
            <li className="flex items-start justify-between gap-3 py-2 text-sm" key={entry.id}>
              <div className="min-w-0">
                <p className="break-words text-coffee-900">
                  {entry.description || (entry.type === 'EARN' ? 'Tích điểm đơn hàng' : 'Sử dụng điểm')}
                </p>
                <time className="text-xs text-coffee-500" dateTime={entry.createdAt}>
                  {date.format(new Date(entry.createdAt))}
                </time>
              </div>
              <span className={`shrink-0 font-bold ${entry.type === 'EARN' ? 'text-emerald-700' : 'text-coffee-700'}`}>
                {entry.type === 'EARN' ? '+' : '−'}{number.format(entry.points)} điểm
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
