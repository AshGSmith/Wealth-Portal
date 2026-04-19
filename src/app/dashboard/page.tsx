'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import CriticalVsNonCriticalBarCard from '@/components/ui/CriticalVsNonCriticalBarCard';
import ExpensesSavingsPieCard from '@/components/ui/ExpensesSavingsPieCard';
import NetWorthTile from '@/components/ui/NetWorthTile';
import Tile from '@/components/ui/Tile';
import {
  calcBudget,
  calcBudgetMetricsForMonth,
  calcBudgetSpendingBreakdownForMonth,
  findBudgetForMonth,
} from '@/lib/budgetCalc';
import { fmtCurrency, fmtMonth } from '@/lib/format';
import { useStore } from '@/lib/store';
import { mortgageLiability, mortgagesWithFixedTermEndingSoon, totalPropertyValue } from '@/lib/wealthCalc';
import type { Debt, DebtHistory, Mortgage, MortgagePayment, Pension, PensionHistory, SavingsAccount, SavingsHistory } from '@/lib/types';

type AlertItem = {
  title: string;
  body: string;
  href: string;
  tone: 'warn' | 'info';
};

function currentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function currentIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLongDateWithOrdinal(date: string): string {
  const [yearPart, monthPart, dayPart] = date.split('-').map(Number);
  const day = dayPart;
  const monthDate = new Date(yearPart, monthPart - 1, dayPart);
  const suffix = day % 10 === 1 && day % 100 !== 11
    ? 'st'
    : day % 10 === 2 && day % 100 !== 12
      ? 'nd'
      : day % 10 === 3 && day % 100 !== 13
        ? 'rd'
        : 'th';

  return `${day}${suffix} ${monthDate.toLocaleString('en-GB', { month: 'long' })} ${yearPart}`;
}

function shiftMonth(month: string, direction: -1 | 1): string {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const date = new Date(year, monthIndex + direction, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthEnd(month: string): string {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const date = new Date(year, monthIndex + 1, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function snapshotBalanceForMonth<T extends { id: string; archived: boolean; currentBalance: number }>(
  records: T[],
  history: Array<{ date: string; balance: number } & Record<string, string | number | null | undefined>>,
  historyKey: string,
  month: string,
): number {
  const isCurrentOrFutureMonth = month >= currentYearMonth();

  return records
    .filter(record => !record.archived)
    .reduce((sum, record) => {
      const latestSnapshot = history
        .filter(entry => String(entry[historyKey]) === record.id && entry.date.slice(0, 7) <= month)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1);

      if (latestSnapshot) {
        return sum + latestSnapshot.balance;
      }

      return sum + (isCurrentOrFutureMonth ? record.currentBalance : 0);
    }, 0);
}

function mortgageLiabilitiesForMonth(
  mortgages: Mortgage[],
  payments: MortgagePayment[],
  month: string,
): number {
  const end = monthEnd(month);

  return mortgages
    .filter(mortgage => !mortgage.archived)
    .reduce((sum, mortgage) => {
      const paymentsToMonth = payments.filter(
        payment => payment.mortgageId === mortgage.id && payment.date <= end,
      );
      return sum + mortgageLiability(mortgage, paymentsToMonth);
    }, 0);
}

export default function DashboardPage() {
  const store = useStore();
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth());
  const mortgageAlerts = mortgagesWithFixedTermEndingSoon(store.mortgages, currentIsoDate(), 60);
  const activeBudget = findBudgetForMonth(store.budgets, selectedMonth);
  const activePots = store.pots.filter(p => !p.archived);
  const budgetCalc = activeBudget
    ? calcBudget(activeBudget, activePots, store.sources, store.entries)
    : null;
  const budgetMetrics = calcBudgetMetricsForMonth(
    selectedMonth,
    store.budgets,
    store.pots,
    store.sources,
    store.entries,
  );
  const budgetSpendingBreakdown = calcBudgetSpendingBreakdownForMonth(
    selectedMonth,
    store.budgets,
    store.pots,
    store.sources,
    store.entries,
  );
  const propertyAssets = totalPropertyValue(store.properties);
  const savingsTotal = snapshotBalanceForMonth<SavingsAccount>(
    store.savingsAccounts,
    store.savingsHistory as Array<SavingsHistory & Record<string, string | number | null | undefined>>,
    'savingsAccountId',
    selectedMonth,
  );
  const debtTotal = snapshotBalanceForMonth<Debt>(
    store.debts,
    store.debtHistory as Array<DebtHistory & Record<string, string | number | null | undefined>>,
    'debtId',
    selectedMonth,
  );
  const pensionTotal = snapshotBalanceForMonth<Pension>(
    store.pensions,
    store.pensionHistory as Array<PensionHistory & Record<string, string | number | null | undefined>>,
    'pensionId',
    selectedMonth,
  );
  const mortgageTotal = mortgageLiabilitiesForMonth(store.mortgages, store.mortgagePayments, selectedMonth);
  const totalAssets = propertyAssets + savingsTotal + pensionTotal;
  const totalLiabilities = mortgageTotal + debtTotal;
  const netWorth = totalAssets - totalLiabilities;

  const summaryTiles = [
    {
      title: 'Income',
      value: fmtCurrency(budgetMetrics.totalIncome),
      subtitle: budgetCalc ? `Income recorded in ${fmtMonth(selectedMonth)}` : `No budget for ${fmtMonth(selectedMonth)}`,
      valueStyle: { color: '#2563eb' },
    },
    {
      title: 'Unallocated',
      value: fmtCurrency(budgetMetrics.totalUnallocatedCash),
      subtitle: budgetCalc ? 'Income minus expenses and savings' : `No budget for ${fmtMonth(selectedMonth)}`,
      valueStyle: { color: budgetMetrics.totalUnallocatedCash >= 0 ? '#10b981' : '#f43f5e' },
    },
    {
      title: 'Expenses',
      value: fmtCurrency(budgetMetrics.totalExpenses),
      subtitle: budgetCalc ? 'Expense allocations in this budget' : `No budget for ${fmtMonth(selectedMonth)}`,
      valueStyle: { color: '#f59e0b' },
    },
    {
      title: 'Savings',
      value: fmtCurrency(budgetMetrics.totalSavings),
      subtitle: budgetCalc ? 'Savings allocations in this budget' : `No budget for ${fmtMonth(selectedMonth)}`,
      valueStyle: { color: '#10b981' },
    },
  ];

  const alerts: AlertItem[] = [];

  for (const mortgageAlert of mortgageAlerts) {
    alerts.push({
      title: 'Mortgage fixed term ending soon',
      body: `${mortgageAlert.lender} ends on ${formatLongDateWithOrdinal(mortgageAlert.endDate)} (${mortgageAlert.daysUntilEnd} day${mortgageAlert.daysUntilEnd === 1 ? '' : 's'} left).`,
      href: `/wealth/mortgages#${mortgageAlert.mortgageId}`,
      tone: 'warn',
    });
  }

  if (budgetCalc && budgetCalc.sourceCalcs.some(source => source.isOverAllocated)) {
    const over = budgetCalc.sourceCalcs.find(source => source.isOverAllocated)!;
    alerts.push({
      title: 'Budget over-allocated',
      body: `${over.source.provider} is overspent by ${fmtCurrency(over.allocated - over.income)} in ${fmtMonth(selectedMonth)}.`,
      href: '/budget',
      tone: 'warn',
    });
  }

  if (store.expenses.some(expense => expense.oneOffPayment && !expense.oneOffAppliedBudgetMonth && !expense.archived)) {
    const pendingCount = store.expenses.filter(expense => expense.oneOffPayment && !expense.oneOffAppliedBudgetMonth && !expense.archived).length;
    alerts.push({
      title: 'Pending one-off expenses',
      body: `${pendingCount} one-off expense${pendingCount === 1 ? '' : 's'} will apply when the next budget is created.`,
      href: '/expenses',
      tone: 'info',
    });
  }

  const monthSelector = (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border px-1.5 py-1"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setSelectedMonth(current => shiftMonth(current, -1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        aria-label="Previous month"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="min-w-0 px-1 text-center">
        <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
          {fmtMonth(selectedMonth)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setSelectedMonth(current => shiftMonth(current, 1))}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        aria-label="Next month"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your finances at a glance." actions={monthSelector} />

      <div className="space-y-4 sm:space-y-5">
        {alerts.length > 0 && (
          <section className="space-y-1.5">
            <div className="space-y-1.5">
              {alerts.map(alert => (
                <Link
                  key={`${alert.title}-${alert.href}`}
                  href={alert.href}
                  className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors"
                  style={{
                    background: alert.tone === 'warn' ? '#78350f14' : 'var(--surface)',
                    borderColor: alert.tone === 'warn' ? '#f59e0b55' : 'var(--border)',
                  }}
                >
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0"
                    style={{ color: alert.tone === 'warn' ? '#f59e0b' : 'var(--primary)' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{alert.title}</p>
                    <p className="mt-0.5 text-[10px] leading-3.5 sm:text-xs sm:leading-4" style={{ color: 'var(--muted)' }}>{alert.body}</p>
                  </div>
                  <ArrowRight size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <div className="space-y-2">
            <NetWorthTile netWorth={netWorth} className="min-h-[98px] sm:min-h-[110px]" />

            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {summaryTiles.map(tile => (
              <Tile
                key={tile.title}
                title={tile.title}
                value={tile.value}
                subtitle={tile.subtitle}
                valueStyle={tile.valueStyle}
                size="sm"
                className="min-h-[86px] sm:min-h-[96px]"
                titleClassName="text-[11px] uppercase tracking-[0.08em]"
                valueClassName="text-[clamp(0.85rem,3vw,1rem)] sm:text-[clamp(0.95rem,1.7vw,1.1rem)]"
                subtitleClassName="text-[10px] leading-3.5 sm:text-[11px] sm:leading-4"
              />
            ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Insights</h2>

          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <ExpensesSavingsPieCard
              expenses={budgetMetrics.totalExpenses}
              savings={budgetMetrics.totalSavings}
              footer={budgetCalc ? `Selected month split for ${fmtMonth(selectedMonth)}.` : `No budget data for ${fmtMonth(selectedMonth)}.`}
            />
            <CriticalVsNonCriticalBarCard
              criticalExpenses={budgetSpendingBreakdown.criticalExpenses}
              nonCriticalExpenses={budgetSpendingBreakdown.nonCriticalExpenses}
              criticalSavings={budgetSpendingBreakdown.criticalSavings}
              nonCriticalSavings={budgetSpendingBreakdown.nonCriticalSavings}
              footer={budgetCalc ? `Criticality split for ${fmtMonth(selectedMonth)}.` : `No budget data for ${fmtMonth(selectedMonth)}.`}
            />
          </div>
        </section>
      </div>
    </>
  );
}
