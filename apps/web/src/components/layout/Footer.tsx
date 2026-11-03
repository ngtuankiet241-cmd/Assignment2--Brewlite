import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer id="about" className="mt-auto border-t border-coffee-200 bg-coffee-950 text-coffee-100">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-coffee-700 text-cream-100">
                <svg
                  className="h-3.5 w-3.5 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M2 19h18a1 1 0 0 0 1-1v-1H2v1a1 1 0 0 0 1 1zm18-14H4v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-1h2a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm1 3a1 1 0 0 1-1 1h-2V7h2a1 1 0 0 1 1 1z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Brew<span className="text-coffee-400">Lite</span>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-coffee-300">
              Cà phê không dùng tiền mặt (Cashless Coffee) – Giải pháp đặt món siêu tốc giữa giờ giải lao cho sinh viên và Gen Z.
            </p>
          </div>

          {/* Quick links & Service info */}
          <div className="space-y-1.5 text-xs text-coffee-300">
            <h3 className="font-semibold uppercase tracking-wider text-white">Phục vụ tại Campus</h3>
            <p>📍 Quầy Pick-up Canteen Trường</p>
            <p>⏰ Mở cửa: 07:00 – 17:30 (Thứ 2 – Thứ 7)</p>
            <div className="pt-1">
              <Link href="/menu" className="text-coffee-400 hover:text-white underline">
                Xem lại thực đơn đồ uống ↑
              </Link>
            </div>
          </div>

          {/* Course & Team info */}
          <div className="space-y-1 text-xs text-coffee-300">
            <h3 className="font-semibold uppercase tracking-wider text-white">Đồ án môn học</h3>
            <p>Môn: <strong>Công nghệ phần mềm</strong></p>
            <p>Giai đoạn: <strong>Task 4.3 – MVP Sprint 1</strong></p>
            <p className="text-coffee-400">Phụ trách Frontend Menu: Triệu &amp; Luân</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-coffee-800/80 pt-4 text-center text-[11px] text-coffee-400">
          <p>© 2026 BrewLite. Phát triển cho mục đích học tập Assignment 2.</p>
        </div>
      </div>
    </footer>
  );
}
