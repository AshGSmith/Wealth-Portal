'use client';

import type { ReactNode } from 'react';

export default function AuthScreen({
  eyebrow,
  title,
  description,
  footer,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-md items-center px-1 py-8">
      <section
        className="w-full overflow-hidden rounded-[2rem] border shadow-sm"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="border-b px-6 py-6"
          style={{
            borderColor: 'var(--border)',
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent)',
          }}
        >
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary)' }}>
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-6" style={{ color: 'var(--muted)' }}>
            {description}
          </p>
        </div>

        <div className="px-6 py-5">
          {children}
        </div>

        {footer ? (
          <div className="border-t px-6 py-4 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}
