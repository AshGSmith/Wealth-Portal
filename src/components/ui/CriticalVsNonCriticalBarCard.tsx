import { BarChart3 } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

type CriticalVsNonCriticalBarCardProps = {
  criticalExpenses: number;
  nonCriticalExpenses: number;
  criticalSavings: number;
  nonCriticalSavings: number;
  title?: string;
  footer?: string;
  className?: string;
};

type BarRow = {
  label: string;
  value: number;
  color: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function CriticalVsNonCriticalBarCard({
  criticalExpenses,
  nonCriticalExpenses,
  criticalSavings,
  nonCriticalSavings,
  title = 'Critical vs Non-Critical',
  footer,
  className,
}: CriticalVsNonCriticalBarCardProps) {
  const rows: BarRow[] = [
    { label: 'Critical Expenses', value: criticalExpenses, color: '#dc2626' },
    { label: 'Non-Critical Expenses', value: nonCriticalExpenses, color: '#f59e0b' },
    { label: 'Critical Savings', value: criticalSavings, color: '#059669' },
    { label: 'Non-Critical Savings', value: nonCriticalSavings, color: '#38bdf8' },
  ];
  const maxValue = Math.max(...rows.map(row => row.value), 0);

  return (
    <div
      className={cx('rounded-xl border p-3', className)}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <BarChart3 size={16} style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
      </div>

      <div className="space-y-2.5">
        {rows.map(row => {
          const widthPercent = maxValue > 0 ? Math.max((row.value / maxValue) * 100, row.value > 0 ? 8 : 0) : 0;

          return (
            <div key={row.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-medium sm:text-xs" style={{ color: 'var(--foreground)' }}>
                  {row.label}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums sm:text-xs" style={{ color: 'var(--muted)' }}>
                  {fmtCurrency(row.value)}
                </span>
              </div>

              <div
                className="h-2.5 overflow-hidden rounded-full"
                style={{ background: 'color-mix(in srgb, var(--surface-hover) 78%, transparent)' }}
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${widthPercent}%`, background: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {footer && (
        <p className="mt-2.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>{footer}</p>
      )}
    </div>
  );
}
