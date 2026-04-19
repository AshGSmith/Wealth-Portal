'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { LogOut, Moon, Sun } from 'lucide-react';
import type { AuthView } from '@/lib/auth/types';
import { logoutAction } from '@/lib/auth/actions';

const AUTH_ROUTES = ['/login', '/forgot-password'];

export default function Header({ auth }: { auth: AuthView | null }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.includes(pathname) || pathname.startsWith('/reset-password/');

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg overflow-hidden shrink-0">
            <Image src="/logo.jpg" alt="WealthPortal" width={28} height={28} className="h-full w-full object-cover" />
          </div>
          <span className="font-semibold text-sm tracking-tight" style={{ color: 'var(--foreground)' }}>
            WealthPortal
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isAuthRoute && auth && (
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{auth.user.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{auth.user.email}</p>
            </div>
          )}

          {!isAuthRoute && auth && (
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="rounded-lg p-2 transition-colors"
                style={{ color: 'var(--primary)', background: 'var(--primary-light)' }}
              >
                <LogOut size={18} />
              </button>
            </form>
          )}

          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}
