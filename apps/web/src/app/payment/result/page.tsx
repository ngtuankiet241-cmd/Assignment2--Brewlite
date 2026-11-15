import { Suspense } from 'react';
import PaymentResultClient from '@/components/payment/PaymentResultClient';

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center px-4">
          <p className="text-sm text-coffee-600">
            Đang tải kết quả thanh toán...
          </p>
        </main>
      }
    >
      <PaymentResultClient />
    </Suspense>
  );
}
