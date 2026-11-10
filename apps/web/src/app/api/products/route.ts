import { NextResponse } from 'next/server';
import { MOCK_PRODUCTS } from '@/data/mockProducts';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://brewlite-api.onrender.com';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(`${backendUrl}/products`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.warn('Backend fetch failed or timed out, using fallback products:', error);
  }

  // Fallback an toàn bảo đảm trang luôn có sản phẩm hiển thị, không bao giờ bị lỗi
  return NextResponse.json(MOCK_PRODUCTS);
}
