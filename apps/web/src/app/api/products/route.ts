import { NextResponse } from 'next/server';
import { parseProductsResponse } from '@/lib/productResponse';

const responseHeaders = { 'Cache-Control': 'no-store' };

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { success: false, message: 'Chưa cấu hình địa chỉ máy chủ API.' },
      { status: 500, headers: responseHeaders },
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, '')}/products`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: 'Không thể tải thực đơn. Vui lòng thử lại.' },
        { status: res.status, headers: responseHeaders },
      );
    }

    const data: unknown = await res.json();
    parseProductsResponse(data);
    return NextResponse.json(data, { headers: responseHeaders });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: controller.signal.aborted
          ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
          : 'Không thể tải dữ liệu sản phẩm hợp lệ. Vui lòng thử lại.',
      },
      { status: controller.signal.aborted ? 504 : 502, headers: responseHeaders },
    );
  } finally {
    clearTimeout(timeout);
  }
}

