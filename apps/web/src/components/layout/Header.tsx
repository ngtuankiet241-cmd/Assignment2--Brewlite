'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/context/useCart';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    router.replace('/menu');
  };

  const navLinks = [
    { href: '/', label: 'Trang chủ' },
    { href: '/menu', label: 'Thực đơn' },
    { href: '/orders', label: 'Đơn của tôi' },
    { href: '/#about', label: 'Về BrewLite' },
  ];

  const mobileLinks = [
    ...navLinks.slice(0, 2),
    { href: '/cart', label: `Giỏ hàng (${itemCount})` },
    navLinks[2],
    ...(!user ? [{ href: '/login', label: 'Đăng nhập' }] : []),
    navLinks[3],
  ];

  const focusClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 focus-visible:ring-offset-2';

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setIsMobileMenuOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-coffee-200/80 bg-white/90 backdrop-blur-md"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
          menuButtonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsMobileMenuOpen(false);
        }
      }}
    >
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
        {/* Brand Logo */}
        <Link
          href="/"
          className={`flex w-fit shrink-0 items-center gap-2 rounded-xl transition active:scale-95 ${focusClasses}`}
          aria-label="BrewLite – Trang chủ"
          onClick={() => setIsMobileMenuOpen(false)}
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
        <nav className="hidden items-center justify-center gap-1 lg:flex" aria-label="Điều hướng chính">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold transition hover:bg-coffee-50 hover:text-coffee-950 ${focusClasses} ${pathname === link.href ? 'bg-coffee-50 text-coffee-950' : 'text-coffee-700'}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop actions: cart appears only here in the desktop header. */}
        <div className="hidden items-center justify-self-end gap-2 lg:flex">
          <Link
            aria-label={`Giỏ hàng, ${itemCount} sản phẩm`}
            aria-current={pathname === '/cart' ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-coffee-200 bg-white px-3 text-sm font-semibold text-coffee-900 transition hover:bg-coffee-50 ${focusClasses}`}
            href="/cart"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l2.2 11.2a2 2 0 002 1.6h8.7a2 2 0 002-1.6L21 7H6M10 21h.01M18 21h.01" />
            </svg>
            <span>Giỏ hàng</span>
            <span aria-hidden="true" className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-coffee-800 px-1.5 text-xs tabular-nums text-white">
              {itemCount}
            </span>
          </Link>

          {user ? (
            <>
              <span className="hidden max-w-28 truncate text-sm font-semibold text-coffee-800 xl:block" title={user.email}>
                Chào, {user.fullName}
              </span>
              <button type="button" onClick={handleLogout} className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-coffee-200 px-3 text-sm font-semibold text-coffee-800 transition hover:bg-coffee-50 ${focusClasses}`}>
                Đăng xuất
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className={`inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full bg-coffee-800 px-4 text-sm font-semibold text-cream-50 shadow-2xs transition hover:bg-coffee-700 active:scale-95 ${focusClasses}`}
            >
              Đăng nhập
            </Link>
          )}
        </div>

        {/* Mobile Menu Hamburger */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-coffee-200 bg-white text-coffee-900 shadow-2xs transition hover:bg-coffee-50 lg:hidden ${focusClasses}`}
          aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
          aria-expanded={isMobileMenuOpen}
          aria-controls={menuId}
        >
          {isMobileMenuOpen ? (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer */}
      <nav
        id={menuId}
        hidden={!isMobileMenuOpen}
        className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-coffee-200 bg-white/95 px-4 py-3 sm:px-6 lg:hidden"
        aria-label="Điều hướng di động"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1">
          {user && (
            <div className="mb-2 border-b border-coffee-100 px-3 pb-3">
              <p className="truncate text-sm font-bold text-coffee-900">{user.fullName}</p>
              <p className="mt-1 truncate text-xs text-coffee-600">{user.email}</p>
            </div>
          )}
          {mobileLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              aria-current={pathname === link.href ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-coffee-900 hover:bg-coffee-50 active:bg-coffee-100 ${focusClasses} ${pathname === link.href ? 'bg-coffee-50' : ''}`}
            >
              <span>{link.label}</span>
              <span aria-hidden="true" className="text-coffee-400">→</span>
            </Link>
          ))}
          {user && (
            <button type="button" onClick={handleLogout} className={`mt-2 min-h-11 rounded-xl border border-coffee-200 px-3 py-2 text-left text-sm font-semibold text-coffee-800 hover:bg-coffee-50 ${focusClasses}`}>
              Đăng xuất
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
