import type { CSSProperties } from 'react';
import { PieChart } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

type ExpensesSavingsPieCardProps = {
  expenses: number;
  savings: number;
  title?: string;
  footer?: string;
  className?: string;
  style?: CSSProperties;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function ExpensesSavingsPieCard({
  expenses,
  savings,
  title = 'Expenses vs Savings',
  footer,
  className,
  style,
}: ExpensesSavingsPieCardProps) {
  const slices = [
    { label: 'Expenses', value: expenses, color: '#f59e0b' },
    { label: 'Savings', value: savings, color: '#10b981' },
  ];
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let runningPercentage = 0;
  const pieBackground = total > 0
    ? `conic-gradient(${slices.map(slice => {
        const start = runningPercentage;
        runningPercentage += (slice.value / total) * 100;
        return `${slice.color} ${start}% ${runningPercentage}%`;
      }).join(', ')})`
    : 'conic-gradient(var(--surface-hover) 0% 100%)';

  return (
    <div
      className={cx('rounded-xl border p-3', className)}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', ...style }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <PieChart size={16} style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28" style={{ background: pieBackground }}>
          <div
            className="absolute inset-[16%] rounded-full"
            style={{ background: 'var(--surface)' }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {slices.map(slice => {
            const percentage = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <div key={slice.label} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                  <span className="text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>
                    {slice.label}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium tabular-nums sm:text-xs" style={{ color: 'var(--foreground)' }}>
                    {fmtCurrency(slice.value)}
                  </div>
                  <div className="text-[10px] sm:text-[11px]" style={{ color: 'var(--muted)' }}>
                    {percentage}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {footer && (
        <p className="mt-2.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>{footer}</p>
      )}
    </div>
  );
}
