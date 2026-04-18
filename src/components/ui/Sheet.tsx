'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open:     boolean;
  onClose:  () => void;
  title:    ReactNode;
  children: ReactNode;
  footer:   ReactNode;
}

/**
 * Shared bottom-sheet modal. Handles z-index, backdrop, safe-area inset,
 * scroll lock, and Escape key. Callers provide title, scrollable body, footer.
 */
export default function Sheet({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center transition-opacity duration-200"
      style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full md:max-w-md flex flex-col rounded-t-2xl md:rounded-2xl transition-transform duration-300"
        style={{
          background: 'var(--surface)',
          maxHeight:  '92dvh',
          transform:  open ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            {title}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer — sits above safe-area */}
        <div
          className="shrink-0 border-t"
          style={{
            borderColor:  'var(--border)',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
