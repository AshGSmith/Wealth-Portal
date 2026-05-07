import { PieChart } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';
import type { SubscriptionCategory } from '@/lib/types';

type Slice = {
  label: SubscriptionCategory;
  value: number;
  color: string;
};

type SubscriptionsByCategoryPieCardProps = {
  slices: Slice[];
  footer?: string;
};

const CATEGORY_COLORS: Record<SubscriptionCategory, string> = {
  Streaming: '#f59e0b',
  Storage: '#2563eb',
  Utility: '#10b981',
  Transport: '#a855f7',
  Finance: '#ef4444',
  Health: '#14b8a6',
  Business: '#64748b',
  Other: '#8b5cf6',
};

export function subscriptionCategoryColor(category: SubscriptionCategory): string {
  return CATEGORY_COLORS[category];
}

export default function SubscriptionsByCategoryPieCard({
  slices,
  footer,
}: SubscriptionsByCategoryPieCardProps) {
  const visibleSlices = slices.filter(slice => slice.value > 0);
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0);
  let runningPercentage = 0;
  const pieBackground = total > 0
    ? `conic-gradient(${visibleSlices.map(slice => {
        const start = runningPercentage;
        runningPercentage += (slice.value / total) * 100;
        return `${slice.color} ${start}% ${runningPercentage}%`;
      }).join(', ')})`
    : 'conic-gradient(var(--surface-hover) 0% 100%)';

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <PieChart size={16} style={{ color: 'var(--primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Subscriptions by Category</h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28" style={{ background: pieBackground }}>
          <div
            className="absolute inset-[16%] rounded-full"
            style={{ background: 'var(--surface)' }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          {visibleSlices.length === 0 ? (
            <p className="text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>
              No active subscriptions for this month.
            </p>
          ) : (
            visibleSlices.map(slice => {
              const percentage = total > 0 ? Math.round((slice.value / total) * 100) : 0;
              return (
                <div key={slice.label} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
                    <span className="truncate text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>
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
            })
          )}
        </div>
      </div>

      {footer && (
        <p className="mt-2.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>{footer}</p>
      )}
    </div>
  );
}
