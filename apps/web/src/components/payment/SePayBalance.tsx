
'use client';

import { useEffect, useState } from 'react';

type Account = {
  id: string;
  bank: string;
  balance: number;
  connectionType: string;
};

export default function SePayBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    fetch(`${apiUrl}/payments/sepay/test-balance`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Không lấy được số dư SePay.');

        const data = await res.json();

        const account = (data.accounts as Account[]).find(
          (a) => a.bank === 'VietinBank',
        );

        if (!account) {
          throw new Error('Không tìm thấy tài khoản VietinBank.');
        }

        setBalance(account.balance);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-800">
        Số dư SePay Test Mode — VietinBank
      </p>

      {balance !== null ? (
        <p className="mt-2 text-2xl font-black text-emerald-700">
          {balance.toLocaleString('vi-VN')} ₫
        </p>
      ) : error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          Đang tải số dư...
        </p>
      )}
    </div>
  );
}
