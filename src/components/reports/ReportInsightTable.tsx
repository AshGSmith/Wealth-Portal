import type { ReactNode } from 'react';

type InsightAlign = 'left' | 'right';
type InsightTone = 'default' | 'muted' | 'value';

type InsightColumn = {
  label: string;
  align?: InsightAlign;
};

type InsightCell = {
  content: ReactNode;
  align?: InsightAlign;
  tone?: InsightTone;
  strong?: boolean;
  truncate?: boolean;
  color?: string;
};

type ReportInsightTableProps = {
  title?: string;
  description?: string;
  columns: InsightColumn[];
  rows: InsightCell[][];
  emptyLabel?: string;
};

function alignmentClass(align: InsightAlign = 'left'): string {
  return align === 'right' ? 'text-right' : 'text-left';
}

function toneStyle(tone: InsightTone = 'default', color?: string): { color: string } {
  if (color) {
    return { color };
  }

  if (tone === 'muted') {
    return { color: 'var(--muted)' };
  }

  return { color: 'var(--foreground)' };
}

export default function ReportInsightTable({
  title,
  description,
  columns,
  rows,
  emptyLabel = 'No data available.',
}: ReportInsightTableProps) {
  return (
    <div className="space-y-1.5">
      {(title || description) ? (
        <div className="space-y-0.5">
          {title ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div
          className="grid gap-2.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            background: 'var(--surface-hover)',
            color: 'var(--muted)',
          }}
        >
          {columns.map(column => (
            <span key={column.label} className={alignmentClass(column.align)}>
              {column.label}
            </span>
          ))}
        </div>

        {rows.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-2.5 px-3 py-1.5 text-[13px]"
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
              >
                {row.map((cell, cellIndex) => (
                  <span
                    key={cellIndex}
                    className={[
                      alignmentClass(cell.align ?? columns[cellIndex]?.align),
                      cell.strong || cell.tone === 'value' ? 'font-semibold' : '',
                      cell.truncate ? 'truncate' : '',
                      cell.tone === 'value' ? 'tabular-nums' : '',
                    ].filter(Boolean).join(' ')}
                    style={toneStyle(cell.tone, cell.color)}
                  >
                    {cell.content}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-2.5 text-[13px]" style={{ color: 'var(--muted)', background: 'var(--surface)' }}>
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
