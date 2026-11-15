
'use client';

import { useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Props {
  orderId: string;
  status: string;
}

export default function PayPendingOrderButton({
  orderId,
  status,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status !== 'PENDING') return null;

  const handlePayment = async () => {
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Vui lòng đăng nhập lại.');
      }

      const response = await fetch(
        `${API_URL}/payments/sepay/checkout-form`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        const message = Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message;

        throw new Error(
          message || `Không thể tạo thanh toán (${response.status}).`,
        );
      }

      if (
        typeof data.checkoutUrl !== 'string' ||
        !data.fields ||
        typeof data.fields !== 'object' ||
        Array.isArray(data.fields)
      ) {
        throw new Error('Dữ liệu Checkout không hợp lệ.');
      }

      const url = new URL(data.checkoutUrl);

      // Chỉ cho phép các tên miền thanh toán Sandbox.
      const allowedHosts = [
        'sandbox.pay.sepay.vn',
        'pay-sandbox.sepay.vn',
      ];

      if (
        url.protocol !== 'https:' ||
        !allowedHosts.includes(url.hostname)
      ) {
        throw new Error(
          `URL thanh toán không hợp lệ: ${url.hostname}`,
        );
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url.toString();
      form.style.display = 'none';

      for (const [key, value] of Object.entries(data.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value ?? '');
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể chuyển sang SePay.';

      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading}
        className="w-full rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading
          ? 'Đang chuyển sang SePay...'
          : 'Thanh toán ngay'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
