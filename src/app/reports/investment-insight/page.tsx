'use client';

import ReportLayout from '@/components/reports/ReportLayout';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';
import {
  purchaseExchangeRateNote,
  purchasePerShareSummary,
  resolveInvestmentCurrentValue,
  totalInvestedForInvestment,
  totalSharesHeldForInvestment,
  useInvestmentMarketQuotes,
} from '@/lib/investmentCalc';
import { useStore } from '@/lib/store';
import { totalInvestmentValue } from '@/lib/wealthCalc';

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtPercentChange(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function InvestmentInsightReportPage() {
  const store = useStore();
  const investments = store.investments.filter(investment => !investment.archived);
  const marketQuotes = useInvestmentMarketQuotes(store.investments, store.investmentPurchases);
  const totalInvested = investments.reduce(
    (sum, investment) => sum + totalInvestedForInvestment(investment.id, store.investmentPurchases),
    0,
  );
  const totalCurrentValue = totalInvestmentValue(
    investments,
    store.investmentPurchases,
    store.investmentValuationHistory,
    marketQuotes,
  );
  const totalGainLoss = totalCurrentValue - totalInvested;
  const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : null;

  const purchasesByInvestment = investments.map(investment => ({
    investment,
    purchases: store.investmentPurchases
      .filter(entry => entry.investmentId === investment.id)
      .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)),
  }));

  const valuationsByInvestment = investments.map(investment => ({
    investment,
    valuations: store.investmentValuationHistory
      .filter(entry => entry.investmentId === investment.id)
      .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate)),
  }));

  return (
    <ReportLayout title="Investment Insight" subtitle="Current investment value, invested cost, and dated purchase and valuation history.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="Total Investment Value" value={fmtCurrency(totalCurrentValue)} valueStyle={{ color: '#0ea5e9' }} />
        <Tile title="Total Invested" value={fmtCurrency(totalInvested)} />
        <Tile
          title="Gain / Loss"
          value={fmtCurrency(totalGainLoss)}
          valueStyle={{ color: totalGainLoss >= 0 ? '#10b981' : '#f43f5e' }}
        />
        <Tile
          title="Gain / Loss %"
          value={totalGainLossPct !== null ? fmtPercentChange(totalGainLossPct) : '—'}
          valueStyle={totalGainLossPct !== null ? { color: totalGainLoss >= 0 ? '#10b981' : '#f43f5e' } : undefined}
        />
      </div>

      <ReportSection title="Breakdown by Investment Holding">
        <div className="space-y-2">
          {investments.length > 0 ? investments.map(investment => {
            const purchases = purchasesByInvestment.find(item => item.investment.id === investment.id)?.purchases ?? [];
            const valuations = valuationsByInvestment.find(item => item.investment.id === investment.id)?.valuations ?? [];
            const resolved = resolveInvestmentCurrentValue(investment, purchases, valuations, marketQuotes);
            const totalInvestedForHolding = resolved.totalInvested;
            const currentValue = resolved.currentValue;
            const gainLoss = currentValue - totalInvestedForHolding;
            const gainLossPct = totalInvestedForHolding > 0 ? (gainLoss / totalInvestedForHolding) * 100 : null;
            const symbolKey = investment.tickerOrSymbol.trim().toUpperCase();
            const sharesHeld = totalSharesHeldForInvestment(investment.id, purchases);
            const liveQuoteFailed = symbolKey.length > 0
              && sharesHeld !== null
              && Object.prototype.hasOwnProperty.call(marketQuotes, symbolKey)
              && marketQuotes[symbolKey] === null;

            return (
              <div
                key={investment.id}
                className="rounded-2xl border p-3 space-y-2.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {investment.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {investment.tickerOrSymbol || 'No ticker'}
                      {investment.provider ? ` • ${investment.provider}` : ''}
                      {resolved.source === 'market' && resolved.marketQuote ? ` • Live ${resolved.marketQuote.currency} quote ${resolved.marketQuote.asOf}` : ''}
                      {resolved.source === 'manual' ? ' • Manual valuation' : ''}
                      {liveQuoteFailed ? ' • Live quote unavailable' : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: '#0ea5e9' }}>
                    {fmtCurrency(currentValue)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile title="Current Value" value={fmtCurrency(currentValue)} size="sm" surface="subtle" valueStyle={{ color: '#0ea5e9' }} />
                  <Tile title="Total Invested" value={fmtCurrency(totalInvestedForHolding)} size="sm" surface="subtle" />
                  <Tile title="Gain / Loss" value={fmtCurrency(gainLoss)} size="sm" surface="subtle" valueStyle={{ color: gainLoss >= 0 ? '#10b981' : '#f43f5e' }} />
                  <Tile
                    title="Gain / Loss %"
                    value={gainLossPct !== null ? fmtPercentChange(gainLossPct) : '—'}
                    size="sm"
                    surface="subtle"
                    valueStyle={gainLossPct !== null ? { color: gainLoss >= 0 ? '#10b981' : '#f43f5e' } : undefined}
                  />
                </div>

                <ReportInsightTable
                  title="Purchase History"
                  columns={[
                    { label: 'Date' },
                    { label: 'Amount', align: 'right' },
                    { label: 'Shares', align: 'right' },
                    { label: 'Per Share', align: 'right' },
                    { label: 'Note' },
                  ]}
                  rows={purchases.map(entry => ([
                    { content: fmtDate(entry.purchaseDate), tone: 'muted' as const },
                    { content: fmtCurrency(entry.amountInvested), align: 'right' as const, tone: 'value' as const },
                    { content: entry.sharesPurchased !== null ? entry.sharesPurchased.toString() : '—', align: 'right' as const, tone: 'muted' as const },
                    { content: purchasePerShareSummary(entry) ?? '—', align: 'right' as const, tone: entry.perSharePriceGbp !== null ? 'value' as const : 'muted' as const },
                    {
                      content: [entry.note?.trim() || null, purchaseExchangeRateNote(entry)]
                        .filter(Boolean)
                        .join(' · ') || '—',
                      truncate: true,
                      tone: entry.note || entry.exchangeRateToGbp ? 'default' as const : 'muted' as const,
                    },
                  ]))}
                  emptyLabel="No purchases logged."
                />

                <ReportInsightTable
                  title="Valuation History"
                  columns={[
                    { label: 'Date' },
                    { label: 'Value', align: 'right' },
                    { label: 'Note' },
                  ]}
                  rows={valuations.map(entry => ([
                    { content: fmtDate(entry.valuationDate), tone: 'muted' as const },
                    { content: fmtCurrency(entry.currentValue), align: 'right' as const, tone: 'value' as const, color: '#0ea5e9' },
                    { content: entry.note?.trim() || '—', truncate: true, tone: entry.note ? 'default' as const : 'muted' as const },
                  ]))}
                  emptyLabel="No valuations logged."
                />
              </div>
            );
          }) : (
            <div
              className="rounded-xl border px-3 py-4 text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              No active investments.
            </div>
          )}
        </div>
      </ReportSection>
    </ReportLayout>
  );
}
