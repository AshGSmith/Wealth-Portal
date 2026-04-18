'use client';

import ReportLayout from '@/components/reports/ReportLayout';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import Tile from '@/components/ui/Tile';
import { fmtCurrency, fmtMonth } from '@/lib/format';
import { useStore } from '@/lib/store';

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sourceTypeLabel(type: string): string {
  return type
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function IncomeTrendsReportPage() {
  const store = useStore();
  const activeSources = store.sources.filter(source => !source.archived);

  const sourceSummaries = activeSources.map(source => {
    const entries = store.entries
      .filter(entry => entry.incomeSourceId === source.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latestEntry = entries[entries.length - 1] ?? null;

    return {
      source,
      entries,
      latestEntry,
      currentAmount: latestEntry?.amount ?? 0,
    };
  });

  const totalCurrentIncome = sourceSummaries.reduce((sum, item) => sum + item.currentAmount, 0);

  const monthlyTotals = Array.from(
    store.entries.reduce((map, entry) => {
      const month = entry.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + entry.amount);
      return map;
    }, new Map<string, number>())
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <ReportLayout title="Income Trends" subtitle="Current income by source with entry history over time.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Tile title="Total Current Income" value={fmtCurrency(totalCurrentIncome)} valueStyle={{ color: '#2563eb' }} />
        <Tile title="Income Sources" value={String(activeSources.length)} />
      </div>

      <ReportSection title="Breakdown by Income Source">
        <div className="space-y-2">
          {sourceSummaries.length > 0 ? sourceSummaries.map(({ source, entries, latestEntry, currentAmount }) => (
            <div
              key={source.id}
              className="rounded-2xl border p-3 space-y-2.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {source.provider}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {sourceTypeLabel(source.type)}
                    {latestEntry ? ` • Latest ${fmtDate(latestEntry.date)}` : ' • No entries yet'}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: '#2563eb' }}>
                  {fmtCurrency(currentAmount)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Tile title="Current Amount" value={fmtCurrency(currentAmount)} size="sm" surface="subtle" valueStyle={{ color: '#2563eb' }} />
                <Tile title="Entries" value={String(entries.length)} size="sm" surface="subtle" />
                <Tile title="Latest Date" value={latestEntry ? fmtDate(latestEntry.date) : '—'} size="sm" surface="subtle" />
              </div>
            </div>
          )) : (
            <div
              className="rounded-xl border px-3 py-4 text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              No active income sources.
            </div>
          )}
        </div>
      </ReportSection>

      {monthlyTotals.length > 0 ? (
        <ReportSection title="Income Trend Over Time">
          <ReportInsightTable
            columns={[
              { label: 'Month' },
              { label: 'Total Income', align: 'right' },
              { label: 'Entries', align: 'right' },
            ]}
            rows={monthlyTotals.map(([month, total]) => {
              const entryCount = store.entries.filter(entry => entry.date.slice(0, 7) === month).length;
              return [
                { content: fmtMonth(month), strong: true },
                { content: fmtCurrency(total), align: 'right' as const, tone: 'value' as const, color: '#2563eb' },
                { content: String(entryCount), align: 'right' as const, tone: 'muted' as const },
              ];
            })}
          />
        </ReportSection>
      ) : null}
    </ReportLayout>
  );
}
