'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, X } from 'lucide-react';
import { PRIMARY_NAV, getSecondaryNav } from '@/lib/nav';

export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const secondaryNav = getSecondaryNav(isAdmin);
  const isAuthRoute = pathname === '/login' || pathname === '/forgot-password' || pathname.startsWith('/reset-password/');
  if (isAuthRoute) return null;

  const secondaryActive = secondaryNav.some(item => pathname === item.href);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="grid grid-cols-4 h-16">
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
                style={{ color: active ? 'var(--primary)' : 'var(--muted)' }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors"
            style={{ color: secondaryActive ? 'var(--primary)' : 'var(--muted)' }}
          >
            <MoreHorizontal size={20} strokeWidth={secondaryActive ? 2.5 : 1.8} />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {showMore && (
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowMore(false)}
        >
          <div
            className="w-full rounded-t-2xl pb-8"
            style={{ background: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + header */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>More</span>
              <button
                onClick={() => setShowMore(false)}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Secondary nav items */}
            <div className="px-3 pt-2 grid grid-cols-2 gap-1">
              {secondaryNav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setShowMore(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-colors"
                    style={{
                      background: active ? 'var(--primary-light)' : 'var(--surface-hover)',
                      color: active ? 'var(--primary)' : 'var(--foreground)',
                    }}
                  >
                    <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
