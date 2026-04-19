'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PRIMARY_NAV, getSecondaryNav } from '@/lib/nav';

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
      style={{
        background: active ? 'var(--primary-light)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
      {label}
    </Link>
  );
}

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const secondaryNav = getSecondaryNav(isAdmin);
  const isAuthRoute = pathname === '/login' || pathname === '/forgot-password' || pathname.startsWith('/reset-password/');
  const secondaryActive = secondaryNav.some(item => pathname === item.href);
  const [moreOpen, setMoreOpen] = useState(secondaryActive);
  if (isAuthRoute) return null;

  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {PRIMARY_NAV.map(item => (
          <NavLink key={item.href} {...item} />
        ))}

        {/* More section */}
        <div className="mt-1">
          <button
            onClick={() => setMoreOpen(v => !v)}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: secondaryActive ? 'var(--primary)' : 'var(--muted)',
              background: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="flex-1 text-left">More</span>
            {moreOpen
              ? <ChevronDown size={14} />
              : <ChevronRight size={14} />
            }
          </button>

          {moreOpen && (
            <div className="mt-1 flex flex-col gap-1 pl-2">
              {secondaryNav.map(item => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
