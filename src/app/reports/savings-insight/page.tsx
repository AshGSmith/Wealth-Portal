'use client';

import ReportLayout from '@/components/reports/ReportLayout';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import ReportSection from '@/components/reports/ReportSection';
import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import { totalSavingsBalance } from '@/lib/wealthCalc';

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

export default function SavingsInsightReportPage() {
  const store = useStore();
  const accounts = store.savingsAccounts.filter(account => !account.archived);
  const totalBalance = totalSavingsBalance(accounts);
  const allHistory = store.savingsHistory
    .filter(entry => accounts.some(account => account.id === entry.savingsAccountId))
    .sort((a, b) => a.date.localeCompare(b.date));

  const historyByAccount = accounts.map(account => ({
    account,
    history: store.savingsHistory
      .filter(entry => entry.savingsAccountId === account.id)
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));

  return (
    <ReportLayout title="Savings Insight" subtitle="Current savings balances and account trends.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Tile title="Total Savings Value" value={fmtCurrency(totalBalance)} valueStyle={{ color: '#10b981' }} />
        <Tile title="Savings Accounts" value={String(accounts.length)} />
      </div>

      <ReportSection title="Breakdown by Savings Account">
        <div className="space-y-2">
          {accounts.length > 0 ? accounts.map(account => {
            const history = historyByAccount.find(item => item.account.id === account.id)?.history ?? [];

            return (
              <div
                key={account.id}
                className="rounded-2xl border p-3 space-y-2.5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                      {account.name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      Interest rate {fmtPercent(account.interestRate)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: '#10b981' }}>
                    {fmtCurrency(account.currentBalance)}
                  </p>
                </div>

                {history.length > 0 ? (
                  <ReportInsightTable
                    title="Savings Balance Trend"
                    columns={[
                      { label: 'Date' },
                      { label: 'Balance', align: 'right' },
                    ]}
                    rows={history.map(point => ([
                      { content: fmtDate(point.date), tone: 'muted' as const },
                      { content: fmtCurrency(point.balance), align: 'right' as const, tone: 'value' as const, color: '#10b981' },
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
              No active savings accounts.
            </div>
          )}
        </div>
      </ReportSection>

      {allHistory.length > 0 ? (
        <ReportSection title="Savings Balance Trend">
          <ReportInsightTable
            columns={[
              { label: 'Account' },
              { label: 'Date' },
              { label: 'Balance', align: 'right' },
            ]}
            rows={allHistory.map(entry => {
              const account = accounts.find(item => item.id === entry.savingsAccountId);
              return [
                { content: account?.name ?? 'Unknown account', strong: true, truncate: true },
                { content: fmtDate(entry.date), tone: 'muted' as const },
                { content: fmtCurrency(entry.balance), align: 'right' as const, tone: 'value' as const, color: '#10b981' },
              ];
            })}
          />
        </ReportSection>
      ) : null}
    </ReportLayout>
  );
}
