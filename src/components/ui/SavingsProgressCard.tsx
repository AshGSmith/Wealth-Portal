import { Target } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

type SavingsProgressCardProps = {
  currentTotal: number;
  targetTotal: number;
  title?: string;
  footer?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function SavingsProgressCard({
  currentTotal,
  targetTotal,
  title = 'Savings Progress',
  footer,
  className,
}: SavingsProgressCardProps) {
  const rawPercentage = targetTotal > 0 ? (currentTotal / targetTotal) * 100 : 0;
  const displayPercentage = Math.round(rawPercentage);
  const progressWidth = Math.min(Math.max(rawPercentage, 0), 100);

  return (
    <div
      className={cx('rounded-xl border p-3', className)}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Target size={16} style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide sm:text-xs" style={{ color: 'var(--muted)' }}>
              Combined savings target
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums sm:text-base" style={{ color: 'var(--foreground)' }}>
              {fmtCurrency(currentTotal)} / {fmtCurrency(targetTotal)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide sm:text-[11px]" style={{ color: 'var(--muted)' }}>
              Complete
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums sm:text-lg" style={{ color: '#10b981' }}>
              {displayPercentage}%
            </p>
          </div>
        </div>

        <div
          className="h-3 overflow-hidden rounded-full"
          style={{ background: 'color-mix(in srgb, var(--surface-hover) 78%, transparent)' }}
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${progressWidth}%`,
              background: 'linear-gradient(90deg, #10b981 0%, #38bdf8 100%)',
            }}
          />
        </div>
      </div>

      {footer && (
        <p className="mt-2.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>{footer}</p>
      )}
    </div>
  );
}
