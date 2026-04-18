'use client';

import ReportLayout from '@/components/reports/ReportLayout';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import { mortgageBalance } from '@/lib/wealthCalc';

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function PropertyInformationReportPage() {
  const store = useStore();
  const properties = store.properties.filter(property => !property.archived);
  const totalValue = properties.reduce((sum, property) => sum + property.currentValue, 0);

  return (
    <ReportLayout title="Property Information" subtitle="Values, purchase details, and mortgage links.">
        <div className="grid grid-cols-2 gap-2">
          <Tile title="Properties" value={String(properties.length)} />
          <Tile title="Total Value" value={fmtCurrency(totalValue)} valueStyle={{ color: '#6366f1' }} />
        </div>

        <ReportSection title="Portfolio">
          <div className="space-y-2">
            {properties.map(property => {
              const mortgage = property.mortgageId
                ? store.mortgages.find(item => item.id === property.mortgageId) ?? null
                : null;
              const mortgagePayments = mortgage
                ? store.mortgagePayments
                    .filter(item => item.mortgageId === mortgage.id)
                    .sort((a, b) => a.date.localeCompare(b.date))
                : [];
              const outstandingMortgageValue = mortgage
                ? mortgageBalance(mortgage, mortgagePayments)
                : 0;
              const gainLoss = property.currentValue - property.purchasePrice;
              const gainLossPct = property.purchasePrice > 0
                ? (gainLoss / property.purchasePrice) * 100
                : 0;
              const mortgageTrend = mortgage
                ? [
                    ...(mortgage.startDate ? [{
                      label: 'Start',
                      date: mortgage.startDate,
                      balance: mortgage.amountBorrowed,
                    }] : []),
                    ...mortgagePayments.map(payment => ({
                      label: 'Payment',
                      date: payment.date,
                      balance: mortgageBalance(
                        mortgage,
                        mortgagePayments.filter(item => item.date <= payment.date),
                      ),
                    })),
                  ]
                : [];

              return (
                <div
                  key={property.id}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{property.name}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{property.address}</p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Tile title="Purchase Date" value={fmtDate(property.purchaseDate)} size="sm" surface="subtle" />
                    <Tile title="Purchase Price" value={fmtCurrency(property.purchasePrice)} size="sm" surface="subtle" />
                    <Tile title="Current Value" value={fmtCurrency(property.currentValue)} size="sm" surface="subtle" />
                    <Tile
                      title="Gain/Loss"
                      value={`${gainLoss >= 0 ? '+' : '−'}${fmtCurrency(Math.abs(gainLoss))}`}
                      subtitle={`${gainLossPct >= 0 ? '+' : ''}${gainLossPct.toFixed(1)}%`}
                      size="sm"
                      surface="subtle"
                      valueStyle={{ color: gainLoss >= 0 ? '#10b981' : '#f43f5e' }}
                    />
                    <Tile title="Linked Mortgage" value={mortgage?.lender ?? 'None'} size="sm" surface="subtle" />
                    <Tile
                      title="Outstanding Mortgage"
                      value={mortgage ? fmtCurrency(outstandingMortgageValue) : '—'}
                      size="sm"
                      surface="subtle"
                      valueStyle={{ color: mortgage ? '#f59e0b' : undefined }}
                    />
                    <Tile
                      title="Property Type"
                      value={property.isRental ? 'Rental' : property.isMainResidence ? 'Main Home' : 'Other'}
                      size="sm"
                      surface="subtle"
                    />
                    <Tile
                      title="Mortgage Status"
                      value={mortgage ? (outstandingMortgageValue > 0 ? 'Active' : 'Cleared') : 'Unencumbered'}
                      size="sm"
                      surface="subtle"
                    />
                  </div>

                  {mortgageTrend.length > 0 && (
                    <div className="mt-3">
                      <ReportInsightTable
                        title="Mortgage Balance Trend"
                        columns={[
                          { label: 'Date' },
                          { label: 'Balance', align: 'right' },
                        ]}
                        rows={mortgageTrend.map(point => ([
                          { content: fmtDate(point.date), tone: 'muted' as const },
                          { content: fmtCurrency(point.balance), align: 'right' as const, tone: 'value' as const, color: '#f59e0b' },
                        ]))}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ReportSection>
    </ReportLayout>
  );
}
