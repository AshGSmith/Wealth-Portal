'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title:     string;
  subtitle?: string;
  actions?:  ReactNode;
  backHref?: string;
}

export default function PageHeader({ title, subtitle, actions, backHref }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-1 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="shrink-0 rounded-lg p-1 -ml-1 mt-0.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
          </Link>
        )}
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
