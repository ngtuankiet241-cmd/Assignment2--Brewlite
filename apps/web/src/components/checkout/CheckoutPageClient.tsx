'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/useCart';
import { getCartItemUnitPrice } from '@/types/cart';
import { formatCurrencyVND } from '@/data/mockProducts';

interface CreatedOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  totalAmount: number;
  status: string;
}

interface PaymentQR {
  qrUrl: string;
  transactionRef: string;
  amount: number;
  status: string;
}

export default function CheckoutPageClient() {
  const { items, itemCount, subtotal, hydrated, clearCart } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'SEPAY_QR' | 'CASH'>('SEPAY_QR');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentQR, setPaymentQR] = useState<PaymentQR | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center text-sm text-coffee-600">
        Đang tải thông tin thanh toán...
      </main>
    );
  }

  // 1. Màn hình hoàn tất đơn hàng
  if (isPaid && createdOrder) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            ✅
          </div>
          <h1 className="mt-4 text-2xl font-black text-coffee-950 sm:text-3xl">
            Đặt hàng & Thanh toán thành công!
          </h1>
          <p className="mt-2 text-sm text-coffee-600">
            Quầy pha chế BrewLite đã nhận được đơn của bạn và đang tiến hành chuẩn bị.
          </p>

          <div className="mt-6 rounded-2xl bg-cream-50 p-4 text-left text-sm text-coffee-800">
            <div className="flex justify-between py-1">
              <span className="text-coffee-600">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-coffee-950">{createdOrder.id}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-coffee-600">Khách hàng:</span>
              <span className="font-semibold">{createdOrder.customerName} ({createdOrder.customerPhone})</span>
            </div>
            {createdOrder.tableNumber && (
              <div className="flex justify-between py-1">
                <span className="text-coffee-600">Số bàn:</span>
                <span className="font-semibold">Bàn #{createdOrder.tableNumber}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-t border-coffee-200/60 mt-2 pt-2">
              <span className="text-coffee-600">Tổng thanh toán:</span>
              <span className="text-base font-extrabold text-coffee-900">
                {formatCurrencyVND(createdOrder.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-coffee-600">Trạng thái:</span>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                ĐÃ THANH TOÁN (PAID)
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white transition hover:bg-coffee-700"
              href="/menu"
            >
              Tiếp tục đặt món
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. Màn hình quét mã QR SePay Sandbox
  if (paymentQR && createdOrder) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:px-6">
        <div className="rounded-3xl border border-coffee-200 bg-white p-6 shadow-md sm:p-8">
          <div className="text-center">
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              Cổng thanh toán SePay Sandbox
            </span>
            <h1 className="mt-3 text-xl font-black text-coffee-950 sm:text-2xl">
              Quét mã QR để thanh toán
            </h1>
            <p className="mt-1 text-xs text-coffee-600">
              Đơn hàng: <span className="font-mono font-semibold">{createdOrder.id}</span>
            </p>
          </div>

          {/* Khối hiển thị ảnh QR SePay */}
          <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-coffee-300 bg-cream-50/60 p-4">
            <div className="relative h-64 w-64 overflow-hidden rounded-xl bg-white p-2 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="SePay QR Code"
                className="h-full w-full object-contain"
                src={paymentQR.qrUrl}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-coffee-800">
              Số tiền: {formatCurrencyVND(createdOrder.totalAmount)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-coffee-500">
              Nội dung: {paymentQR.transactionRef}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Nút mô phỏng thanh toán thành công qua Webhook */}
          <div className="space-y-3">
            <button
              className="w-full min-h-12 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              disabled={simulatingPayment}
              onClick={async () => {
                try {
                  setSimulatingPayment(true);
                  setError(null);
                  const res = await fetch(`${apiUrl}/payments/sepay/webhook-ipn`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      orderId: createdOrder.id,
                      transactionRef: paymentQR.transactionRef,
                      amount: createdOrder.totalAmount,
                      status: 'SUCCESS',
                    }),
                  });
                  if (!res.ok) {
                    throw new Error('Lỗi kích hoạt webhook SePay');
                  }
                  clearCart();
                  setIsPaid(true);
                } catch (e: any) {
                  setError(e.message || 'Mô phỏng thanh toán thất bại');
                } finally {
                  setSimulatingPayment(false);
                }
              }}
              type="button"
            >
              {simulatingPayment ? 'Đang xử lý giao dịch...' : '⚡ Giả lập thanh toán thành công (Webhook IPN)'}
            </button>

            <button
              className="w-full min-h-11 rounded-full border border-coffee-300 text-sm font-semibold text-coffee-800 transition hover:bg-cream-100"
              onClick={() => {
                clearCart();
                setIsPaid(true);
              }}
              type="button"
            >
              Tôi đã chuyển khoản xong
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 3. Giỏ hàng trống
  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-16 text-center">
        <span className="text-4xl">🛒</span>
        <h1 className="mt-4 text-xl font-bold text-coffee-950">Giỏ hàng của bạn đang trống</h1>
        <p className="mt-1 text-sm text-coffee-600">Vui lòng chọn thức uống trước khi tiến hành thanh toán.</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white hover:bg-coffee-700"
          href="/menu"
        >
          Quay lại thực đơn
        </Link>
      </main>
    );
  }

  // 4. Form thông tin đặt hàng & xem lại đơn
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Vui lòng nhập đầy đủ họ tên và số điện thoại nhận đơn.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const orderPayload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        tableNumber: tableNumber ? parseInt(tableNumber, 10) : undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => {
          const unitPrice = getCartItemUnitPrice(item);
          const toppingString = item.toppings
            .map((t) => (t.quantity > 1 ? `${t.name} x${t.quantity}` : t.name))
            .join(', ');

          return {
            productId: item.productId,
            productName: item.productName,
            unitPrice,
            quantity: item.quantity,
            size: item.size,
            toppings: toppingString || undefined,
            itemTotal: unitPrice * item.quantity,
          };
        }),
      };

      // Gửi yêu cầu tạo đơn hàng POST /orders (kèm JWT nếu đã đăng nhập)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const orderHeaders: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        orderHeaders['Authorization'] = `Bearer ${token}`;
      }
      const orderRes = await fetch(`${apiUrl}/orders`, {
        method: 'POST',
        headers: orderHeaders,
        body: JSON.stringify(orderPayload),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => null);
        throw new Error(errorData?.message || `Lỗi máy chủ (${orderRes.status})`);
      }

      const orderData: CreatedOrder = await orderRes.json();
      setCreatedOrder(orderData);

      // Nếu chọn thanh toán SePay QR -> gọi API lấy QR
      if (paymentMethod === 'SEPAY_QR') {
        const qrRes = await fetch(`${apiUrl}/payments/sepay/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.id,
            amount: orderData.totalAmount,
            idempotencyKey: `idem-${orderData.id}`,
          }),
        });

        if (qrRes.ok) {
          const qrData: PaymentQR = await qrRes.json();
          setPaymentQR(qrData);
          return;
        }
      }

      // Nếu thanh toán tiền mặt tại quầy
      clearCart();
      setIsPaid(true);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link className="text-xs font-semibold text-coffee-600 hover:text-coffee-900" href="/cart">
          ← Quay lại giỏ hàng
        </Link>
        <h1 className="mt-2 text-2xl font-black text-coffee-950 sm:text-3xl">
          Xác nhận đặt hàng & Thanh toán
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          Vui lòng kiểm tra lại món và điền thông tin để BrewLite phục vụ bạn tốt nhất.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800" role="alert">
          {error}
        </div>
      )}

      <form className="grid gap-8 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmitOrder}>
        {/* Cột trái: Thông tin nhận đơn */}
        <section aria-label="Thông tin nhận đơn" className="space-y-6">
          <div className="rounded-2xl border border-coffee-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <h2 className="text-base font-bold text-coffee-950">Thông tin khách hàng</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-coffee-800" htmlFor="customerName">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
                  id="customerName"
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                  type="text"
                  value={customerName}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-coffee-800" htmlFor="customerPhone">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
                  id="customerPhone"
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ví dụ: 0901234567"
                  required
                  type="tel"
                  value={customerPhone}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-coffee-800" htmlFor="tableNumber">
                  Số bàn (nếu dùng tại quán)
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
                  id="tableNumber"
                  min="1"
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ví dụ: 4"
                  type="number"
                  value={tableNumber}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-coffee-800" htmlFor="notes">
                  Ghi chú cho quầy pha chế
                </label>
                <input
                  className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
                  id="notes"
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ví dụ: Ít đá, nhiều sữa"
                  type="text"
                  value={notes}
                />
              </div>
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div className="rounded-2xl border border-coffee-200/80 bg-white p-5 shadow-2xs sm:p-6">
            <h2 className="text-base font-bold text-coffee-950">Phương thức thanh toán</h2>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-coffee-200 bg-cream-50/40 p-3.5 transition hover:bg-cream-100/60">
                <div className="flex items-center gap-3">
                  <input
                    checked={paymentMethod === 'SEPAY_QR'}
                    className="h-4 w-4 accent-coffee-800"
                    name="paymentMethod"
                    onChange={() => setPaymentMethod('SEPAY_QR')}
                    type="radio"
                    value="SEPAY_QR"
                  />
                  <div>
                    <p className="text-sm font-bold text-coffee-950">Chuyển khoản SePay QR (Mô phỏng Sandbox)</p>
                    <p className="text-xs text-coffee-500">Quét mã QR qua ứng dụng ngân hàng hoặc ví điện tử</p>
                  </div>
                </div>
                <span className="text-xl">📱</span>
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-coffee-200 bg-cream-50/40 p-3.5 transition hover:bg-cream-100/60">
                <div className="flex items-center gap-3">
                  <input
                    checked={paymentMethod === 'CASH'}
                    className="h-4 w-4 accent-coffee-800"
                    name="paymentMethod"
                    onChange={() => setPaymentMethod('CASH')}
                    type="radio"
                    value="CASH"
                  />
                  <div>
                    <p className="text-sm font-bold text-coffee-950">Tiền mặt tại quầy</p>
                    <p className="text-xs text-coffee-500">Thanh toán trực tiếp khi nhận nước tại quầy thu ngân</p>
                  </div>
                </div>
                <span className="text-xl">💵</span>
              </label>
            </div>
          </div>
        </section>

        {/* Cột phải: Xem lại giỏ hàng & nút đặt */}
        <aside aria-label="Xem lại đơn hàng" className="h-fit space-y-4 rounded-2xl border border-coffee-200/80 bg-white p-5 shadow-2xs">
          <h2 className="text-base font-bold text-coffee-950">Món đã chọn ({itemCount} ly)</h2>
          
          <div className="max-h-64 divide-y divide-coffee-100 overflow-y-auto pr-1 text-sm">
            {items.map((item) => {
              const unitPrice = getCartItemUnitPrice(item);
              const toppingDesc = item.toppings.map((t) => t.name).join(', ');

              return (
                <div className="flex justify-between py-2.5" key={item.id}>
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-semibold text-coffee-950">
                      {item.quantity}x {item.productName} (Size {item.size})
                    </p>
                    {toppingDesc && (
                      <p className="text-[11px] text-coffee-500 truncate">+ {toppingDesc}</p>
                    )}
                  </div>
                  <span className="font-bold text-coffee-900 shrink-0">
                    {formatCurrencyVND(unitPrice * item.quantity)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-coffee-200/70 pt-3">
            <div className="flex justify-between text-sm text-coffee-600">
              <span>Tạm tính</span>
              <span>{formatCurrencyVND(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-coffee-950">Tổng thanh toán</span>
              <span className="text-xl font-black text-coffee-900">{formatCurrencyVND(subtotal)}</span>
            </div>
          </div>

          <button
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-coffee-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-coffee-700 active:scale-[0.98] disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Đang khởi tạo đơn hàng...' : 'Xác nhận đặt hàng →'}
          </button>
        </aside>
      </form>
    </main>
  );
}

