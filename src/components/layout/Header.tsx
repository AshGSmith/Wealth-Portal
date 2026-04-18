'use client';

import Image from 'next/image';
import { useTheme } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';

export default function Header() {
  const { theme, toggle } = useTheme();

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
    </header>
  );
}
