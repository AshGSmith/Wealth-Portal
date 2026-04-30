import { Activity } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';
import type { InvestmentValueTrendPoint } from '@/lib/investmentCalc';

type InvestmentValueTrendCardProps = {
  points: InvestmentValueTrendPoint[];
  title?: string;
  footer?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function polylinePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export default function InvestmentValueTrendCard({
  points,
  title = 'Investment Value Trend',
  footer,
  className,
}: InvestmentValueTrendCardProps) {
  if (points.length === 0) {
    return null;
  }

  const width = 320;
  const height = 176;
  const left = 12;
  const right = 12;
  const top = 10;
  const bottom = 24;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...points.map(point => Math.max(point.valueTotal, point.investedTotal, point.trendValue)), 1);
  const minValue = 0;
  const valueRange = Math.max(maxValue - minValue, 1);

  const chartPoints = points.map((point, index) => {
    const x = left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const valueY = top + ((maxValue - point.valueTotal) / valueRange) * chartHeight;
    const trendY = top + ((maxValue - point.trendValue) / valueRange) * chartHeight;
    const investedY = top + ((maxValue - point.investedTotal) / valueRange) * chartHeight;
    return { ...point, x, valueY, trendY, investedY };
  });

  const blueLine = polylinePath(chartPoints.map(point => ({ x: point.x, y: point.valueY })));
  const yellowLine = polylinePath(chartPoints.map(point => ({ x: point.x, y: point.trendY })));
  const redLine = polylinePath(chartPoints.map(point => ({ x: point.x, y: point.investedY })));
  const redArea = [
    `M ${chartPoints[0].x} ${height - bottom}`,
    ...chartPoints.map(point => `L ${point.x} ${point.investedY}`),
    `L ${chartPoints[chartPoints.length - 1].x} ${height - bottom}`,
    'Z',
  ].join(' ');

  const latest = points[points.length - 1];
  const gainLoss = latest.valueTotal - latest.investedTotal;
  const gainLossPct = latest.investedTotal > 0 ? (gainLoss / latest.investedTotal) * 100 : null;
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <div
      className={cx('rounded-xl border p-3', className)}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Activity size={16} style={{ color: '#2563eb' }} />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
            <p className="mt-0.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>
              {fmtCurrency(latest.valueTotal)} vs {fmtCurrency(latest.investedTotal)} invested
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide sm:text-[11px]" style={{ color: 'var(--muted)' }}>
            Gain / Loss
          </p>
          <p
            className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base"
            style={{ color: gainLoss >= 0 ? '#38bdf8' : '#f43f5e' }}
          >
            {gainLoss >= 0 ? '+' : ''}{fmtCurrency(gainLoss)}
          </p>
          {gainLossPct !== null && (
            <p className="text-[10px] tabular-nums sm:text-[11px]" style={{ color: 'var(--muted)' }}>
              {gainLoss >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full overflow-visible">
          <defs>
            <linearGradient id="investment-value-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map(marker => {
            const y = top + (chartHeight * marker);
            return (
              <line
                key={marker}
                x1={left}
                y1={y}
                x2={width - right}
                y2={y}
                stroke="color-mix(in srgb, var(--border) 70%, transparent)"
                strokeWidth="1"
              />
            );
          })}

          <path d={redArea} fill="#ef44441c" />
          <path
            d={`${blueLine} L ${chartPoints[chartPoints.length - 1].x} ${height - bottom} L ${chartPoints[0].x} ${height - bottom} Z`}
            fill="url(#investment-value-fill)"
          />
          <path d={redLine} fill="none" stroke="#ef4444" strokeWidth="2" />
          <path d={yellowLine} fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="5 4" />
          <path d={blueLine} fill="none" stroke="#2563eb" strokeWidth="2.75" />

          {chartPoints.map(point => (
            <circle key={point.month} cx={point.x} cy={point.valueY} r="2.4" fill="#2563eb" />
          ))}
        </svg>

        <div className="mt-1 flex items-center gap-3 text-[10px] sm:text-[11px]" style={{ color: 'var(--muted)' }}>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: '#2563eb' }} />
            Total value
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: '#facc15' }} />
            Trend
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: '#ef4444' }} />
            Invested
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] sm:text-[11px]" style={{ color: 'var(--muted)' }}>
          {labelIndexes.map(index => (
            <span key={points[index].month} className="min-w-0">
              {points[index].label}
            </span>
          ))}
        </div>
      </div>

      {footer && (
        <p className="mt-2.5 text-[11px] sm:text-xs" style={{ color: 'var(--muted)' }}>{footer}</p>
      )}
    </div>
  );
}
