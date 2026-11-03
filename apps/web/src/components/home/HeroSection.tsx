import React from 'react';

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-3 pb-2 sm:pt-6 sm:pb-4">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Compact Banner that does not push Menu down */}
        <div className="rounded-3xl border border-coffee-200/80 bg-white/80 p-3.5 shadow-2xs sm:p-6 backdrop-blur-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-coffee-100 px-3 py-1 text-[11px] font-semibold text-coffee-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>BrewLite Campus • Cashless Ordering</span>
              </div>
              <h1 className="mt-2 text-xl font-black tracking-tight text-coffee-950 sm:text-2xl md:text-3xl">
                Cà phê chuẩn gu, không lo tiền lẻ
              </h1>
              <p className="mt-1 max-w-xl text-xs text-coffee-700/80 sm:text-sm">
                Đặt món nhanh trong giờ chuyển tiết, thanh toán không chạm và nhận ngay tại quầy Canteen.
              </p>
            </div>

            {/* Quick status pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-0">
              <span className="inline-flex items-center gap-1 rounded-2xl bg-cream-100 px-3 py-1.5 text-xs font-semibold text-coffee-800 border border-coffee-200/60">
                ⚡ ~3 phút lấy nước
              </span>
              <span className="inline-flex items-center gap-1 rounded-2xl bg-cream-100 px-3 py-1.5 text-xs font-semibold text-coffee-800 border border-coffee-200/60">
                💳 100% Không tiền mặt
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
