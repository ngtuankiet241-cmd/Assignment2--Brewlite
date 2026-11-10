'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/useCart';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { itemCount } = useCart();

  const navLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/menu', label: 'Thực đơn' },
    { href: '/cart', label: `Giỏ hàng${itemCount > 0 ? ` (${itemCount})` : ''}` },
    { href: '/#about', label: 'Về BrewLite' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-coffee-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition active:scale-95 shrink-0"
          aria-label="BrewLite Homepage"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-coffee-800 text-cream-100 shadow-2xs sm:h-9 sm:w-9 sm:rounded-2xl shrink-0">
            <svg
              className="h-4 w-4 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M2 19h18a1 1 0 0 0 1-1v-1H2v1a1 1 0 0 0 1 1zm18-14H4v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-1h2a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm1 3a1 1 0 0 1-1 1h-2V7h2a1 1 0 0 1 1 1z" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-base font-black tracking-tight text-coffee-950 sm:text-xl leading-none">
              Brew<span className="text-coffee-600">Lite</span>
            </span>
            <span className="text-[9px] font-semibold tracking-wider uppercase text-coffee-500 mt-0.5">
              Cashless Coffee
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Điều hướng chính">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold text-coffee-800 transition hover:text-coffee-600 rounded-lg px-2 py-1"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Action: Desktop & Mobile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            aria-label={`Giỏ hàng, ${itemCount} sản phẩm`}
            className="relative inline-flex h-9 items-center gap-1.5 rounded-full border border-coffee-200 bg-white px-3 text-xs font-semibold text-coffee-900 transition hover:bg-coffee-50"
            href="/cart"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l2.2 11.2a2 2 0 002 1.6h8.7a2 2 0 002-1.6L21 7H6M10 21h.01M18 21h.01" />
            </svg>
            <span>Giỏ</span>
            {itemCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-coffee-800 px-1.5 py-0.5 text-[10px] text-white">
                {itemCount}
              </span>
            )}
          </Link>

          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-coffee-50 px-3 py-1 text-xs font-semibold text-coffee-700 border border-coffee-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            100% Cashless
          </span>

          <Link
            href="/menu"
            className="rounded-full bg-coffee-800 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-cream-50 shadow-2xs transition hover:bg-coffee-700 active:scale-95"
          >
            Menu
          </Link>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-coffee-200 bg-white text-coffee-900 shadow-2xs md:hidden"
            aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="border-b border-coffee-200 bg-white/95 px-4 pt-2 pb-4 md:hidden">
          <nav className="flex flex-col space-y-1" aria-label="Menu di động">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-coffee-900 hover:bg-coffee-50 active:bg-coffee-100"
              >
                <span>{link.label}</span>
                <span className="text-coffee-400">→</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
