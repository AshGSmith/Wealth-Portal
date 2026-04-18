'use client';

import ReportLayout from '@/components/reports/ReportLayout';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import { totalDebtBalance } from '@/lib/wealthCalc';

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function debtTypeLabel(type: 'loan' | 'credit-card'): string {
  return type === 'credit-card' ? 'Credit Card' : 'Loan';
}

export default function DebtInsightReportPage() {
  const store = useStore();
  const debts = store.debts.filter(debt => !debt.archived);
  const totalBalance = totalDebtBalance(debts);
  const allHistory = store.debtHistory
    .filter(entry => debts.some(debt => debt.id === entry.debtId))
    .sort((a, b) => a.date.localeCompare(b.date));

  const historyByDebt = debts.map(debt => ({
    debt,
    history: store.debtHistory
      .filter(entry => entry.debtId === debt.id)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));

  return (
    <ReportLayout title="Debt Insight" subtitle="Current debt balances with record-level breakdown and history.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Tile title="Total Debt Amount" value={fmtCurrency(totalBalance)} valueStyle={{ color: '#f43f5e' }} />
        <Tile title="Debt Records" value={String(debts.length)} />
      </div>

      <ReportSection title="Breakdown by Debt Record">
        <div className="space-y-2">
          {debts.length > 0 ? debts.map(debt => {
            const history = historyByDebt.find(item => item.debt.id === debt.id)?.history ?? [];

            return (
              <div
                key={debt.id}
                className="rounded-2xl border p-3 space-y-2.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {debt.name}
                      </p>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                        style={{ background: debt.debtType === 'credit-card' ? '#2563eb22' : '#10b98122', color: debt.debtType === 'credit-card' ? '#2563eb' : '#10b981' }}
                      >
                        {debtTypeLabel(debt.debtType)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      {debt.provider}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: '#f43f5e' }}>
                    {fmtCurrency(debt.currentBalance)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile title="Current Balance" value={fmtCurrency(debt.currentBalance)} size="sm" surface="subtle" valueStyle={{ color: '#f43f5e' }} />
                  <Tile title="Debt Type" value={debtTypeLabel(debt.debtType)} size="sm" surface="subtle" />
                  <Tile title="Interest Rate" value={debt.interestRate > 0 ? fmtPercent(debt.interestRate) : '—'} size="sm" surface="subtle" />
                  <Tile title="Original Amount" value={debt.borrowedAmount !== null ? fmtCurrency(debt.borrowedAmount) : '—'} size="sm" surface="subtle" />
                </div>

                {history.length > 0 ? (
                  <ReportInsightTable
                    title="Debt Balance Trend"
                    columns={[
                      { label: 'Date' },
                      { label: 'Balance', align: 'right' },
                    ]}
                    rows={history.map(point => ([
                      { content: fmtDate(point.date), tone: 'muted' as const },
                      { content: fmtCurrency(point.balance), align: 'right' as const, tone: 'value' as const, color: '#f43f5e' },
                    ]))}
                  />
                ) : null}
              </div>
            );
          }) : (
            <div
              className="rounded-xl border px-3 py-4 text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--muted)' }}
            >
              No active debt records.
            </div>
          )}
        </div>
      </ReportSection>

      {allHistory.length > 0 ? (
        <ReportSection title="Debt Balance Trend">
          <ReportInsightTable
            columns={[
              { label: 'Debt' },
              { label: 'Date' },
              { label: 'Balance', align: 'right' },
            ]}
            rows={allHistory.map(entry => {
              const debt = debts.find(item => item.id === entry.debtId);
              return [
                { content: debt?.name ?? 'Unknown debt', strong: true, truncate: true },
                { content: fmtDate(entry.date), tone: 'muted' as const },
                { content: fmtCurrency(entry.balance), align: 'right' as const, tone: 'value' as const, color: '#f43f5e' },
              ];
            })}
          />
        </ReportSection>
      ) : null}
    </ReportLayout>
  );
}
