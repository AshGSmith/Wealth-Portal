import { forwardRef } from 'react';
import ReportDocument from '@/components/reports/ReportDocument';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import ExpensesSavingsPieCard from '@/components/ui/ExpensesSavingsPieCard';
import Tile from '@/components/ui/Tile';
import { calcBudgetMetrics, type BudgetCalc } from '@/lib/budgetCalc';
import { fmtCurrency, fmtMonth } from '@/lib/format';
import type { IncomeSource } from '@/lib/types';

function sourceLabelForItems(sourceIds: string[], sources: IncomeSource[]): string {
  const labels = sourceIds
    .map(sourceId => sources.find(item => item.id === sourceId)?.provider)
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) return '—';
  if (labels.length === 1) return labels[0];
  return `${labels[0]} +${labels.length - 1} more`;
}

type BudgetExportDocumentProps = {
  month: string;
  budgetStatus: string;
  calc: BudgetCalc;
  sources: IncomeSource[];
};

const BudgetExportDocument = forwardRef<HTMLDivElement, BudgetExportDocumentProps>(function BudgetExportDocument({
  month,
  budgetStatus,
  calc,
  sources,
}, ref) {
  const metrics = calcBudgetMetrics(calc);

  return (
    <ReportDocument
      ref={ref}
      title="Budget Export"
      subtitle={`${fmtMonth(month)} budget summary`}
    >
      <ReportSection title="Budget Header">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Tile title="Budget Month" value={fmtMonth(month)} size="sm" />
          <Tile title="Budget Status" value={budgetStatus} size="sm" />
        </div>
      </ReportSection>

      <ReportSection title="Expenses vs Savings">
        <ExpensesSavingsPieCard
          expenses={metrics.totalExpenses}
          savings={metrics.totalSavings}
          footer="Selected budget month only."
        />
      </ReportSection>

      <ReportSection title="Budget Summary">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Tile title="Total Income" value={fmtCurrency(metrics.totalIncome)} size="sm" />
          <Tile title="Total Expenses" value={fmtCurrency(metrics.totalExpenses)} size="sm" valueStyle={{ color: '#f59e0b' }} />
          <Tile title="Total Savings" value={fmtCurrency(metrics.totalSavings)} size="sm" valueStyle={{ color: '#10b981' }} />
          <Tile title="Total Committed" value={fmtCurrency(metrics.totalCommitted)} size="sm" />
          <Tile
            title="Total Unallocated"
            value={`${metrics.totalUnallocatedCash >= 0 ? '+' : ''}${fmtCurrency(metrics.totalUnallocatedCash)}`}
            size="sm"
            valueStyle={{ color: metrics.totalUnallocatedCash >= 0 ? '#10b981' : '#f43f5e' }}
          />
        </div>
      </ReportSection>

      <ReportSection title="Pot Breakdown">
        <ReportInsightTable
          columns={[
            { label: 'Pot' },
            { label: 'Income Source' },
            { label: 'Total Required', align: 'right' },
          ]}
          rows={calc.potCalcs.map(({ pot, total }) => {
            const sourceIds = [...new Set(calc.sourceCalcs.filter(sourceCalc => sourceCalc.potIds.includes(pot.id)).map(sourceCalc => sourceCalc.source.id))];
            return [
              { content: pot.name, strong: true, truncate: true },
              { content: sourceLabelForItems(sourceIds, sources), tone: 'muted' as const, truncate: true },
              { content: fmtCurrency(total), align: 'right' as const, tone: 'value' as const },
            ];
          })}
          emptyLabel="No pots in this budget."
        />
      </ReportSection>

      <ReportSection title="Pot Detail Breakdown">
        <div className="space-y-2">
          {calc.potCalcs.map(({ pot, total, items }) => {
            const sourceIds = [...new Set(items.map(item => item.incomeSourceId))];

            return (
              <div
                key={pot.id}
                className="rounded-2xl border p-3 space-y-2.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-end justify-between gap-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {pot.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {sourceLabelForItems(sourceIds, sources)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-right" style={{ color: 'var(--foreground)' }}>
                    {fmtCurrency(total)}
                  </p>
                </div>

                <ReportInsightTable
                  columns={[
                    { label: 'Name' },
                    { label: 'Type' },
                    { label: 'Amount', align: 'right' },
                  ]}
                  rows={items.map(item => ([
                    { content: item.name, strong: true, truncate: true },
                    { content: item.sourceType === 'expense' ? 'Expense' : 'Saving', tone: 'muted' as const },
                    {
                      content: fmtCurrency(item.amount),
                      align: 'right' as const,
                      tone: 'value' as const,
                      color: item.sourceType === 'expense' ? '#f59e0b' : '#10b981',
                    },
                  ]))}
                  emptyLabel="No items in this pot."
                />
              </div>
            );
          })}
        </div>
      </ReportSection>
    </ReportDocument>
  );
});

export default BudgetExportDocument;
