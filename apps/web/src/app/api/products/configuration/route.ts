import { NextResponse } from 'next/server';
import { parseProductConfiguration } from '@/lib/productConfiguration';

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
    const response = await fetch(
      `${backendUrl.replace(/\/$/, '')}/products/configuration`,
      {
        cache: 'no-store',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: 'Không thể tải tùy chọn sản phẩm. Vui lòng thử lại.' },
        { status: response.status, headers: responseHeaders },
      );
    }

    const data: unknown = await response.json();
    parseProductConfiguration(data);
    return NextResponse.json(data, { headers: responseHeaders });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: controller.signal.aborted
          ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
          : 'Không thể tải tùy chọn sản phẩm hợp lệ. Vui lòng thử lại.',
      },
      { status: controller.signal.aborted ? 504 : 502, headers: responseHeaders },
    );
  } finally {
    clearTimeout(timeout);
  }
}
