'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

type ReportDownloadButtonProps = {
  onClick: () => Promise<void> | void;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function ReportDownloadButton({ onClick, className }: ReportDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (isLoading) return;

    try {
      setIsLoading(true);
      await onClick();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cx(
        'print:hidden flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-70',
        className,
      )}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    >
      <Download size={13} />
      <span className="hidden sm:inline">{isLoading ? 'Generating PDF' : 'Download PDF'}</span>
      <span className="sm:hidden">{isLoading ? '...' : 'PDF'}</span>
    </button>
  );
}
