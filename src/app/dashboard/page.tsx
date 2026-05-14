'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import CriticalVsNonCriticalBarCard from '@/components/ui/CriticalVsNonCriticalBarCard';
import ExpensesSavingsPieCard from '@/components/ui/ExpensesSavingsPieCard';
import InvestmentValueTrendCard from '@/components/ui/InvestmentValueTrendCard';
import NetWorthTile from '@/components/ui/NetWorthTile';
import SavingsProgressCard from '@/components/ui/SavingsProgressCard';
import SubscriptionsByCategoryPieCard, { subscriptionCategoryColor } from '@/components/ui/SubscriptionsByCategoryPieCard';
import Tile from '@/components/ui/Tile';
import { resolveSubscriptionForMonth, subscriptionPriceForMonth } from '@/lib/budgetLogic';
import { combinedInvestmentValueTrend, dramaticInvestmentDrops, useInvestmentMarketQuotes } from '@/lib/investmentCalc';
import {
  calcBudget,
  calcBudgetMetricsForMonth,
  calcBudgetSpendingBreakdownForMonth,
  findBudgetForMonth,
} from '@/lib/budgetCalc';
import { fmtCurrency, fmtMonth } from '@/lib/format';
import { useStore } from '@/lib/store';
import {
  currenciesRequiringFx,
  exchangeRatePath,
  subscriptionAmountToGbp,
  type SubscriptionFxRates,
} from '@/lib/subscriptionCurrency';
import { subscriptionLifecycleAlerts } from '@/lib/subscriptionCalc';
import { calcWealthForMonth, mortgagesWithFixedTermEndingSoon } from '@/lib/wealthCalc';
import type { SubscriptionCategory, SubscriptionCurrency } from '@/lib/types';

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

function subscriptionAmountForBudgetMonth(cost: number, schedule: string): number {
  if (schedule === 'Weekly') return (cost * 52) / 12;
  return cost;
}

export default function DashboardPage() {
  const store = useStore();
  const investmentMarketQuotes = useInvestmentMarketQuotes(store.investments, store.investmentPurchases);
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth());
  const [subscriptionFxRates, setSubscriptionFxRates] = useState<SubscriptionFxRates>({});
  const [subscriptionFxUnavailableCurrencies, setSubscriptionFxUnavailableCurrencies] = useState<Array<Exclude<SubscriptionCurrency, 'GBP'>>>([]);
  const INVESTMENT_DROP_ALERT_THRESHOLD = 0.15;
  const mortgageAlerts = mortgagesWithFixedTermEndingSoon(store.mortgages, currentIsoDate(), 60);
  const investmentDropAlerts = dramaticInvestmentDrops(
    store.investments,
    store.investmentPurchases,
    store.investmentValuationHistory,
    investmentMarketQuotes,
    INVESTMENT_DROP_ALERT_THRESHOLD,
  );
  const investmentValueTrend = combinedInvestmentValueTrend(
    store.investments,
    store.investmentPurchases,
    store.investmentValuationHistory,
    investmentMarketQuotes,
    currentIsoDate(),
  );
  const monthlySubscriptionRows = useMemo(() => store.subscriptions
    .flatMap(subscription => {
      const resolved = resolveSubscriptionForMonth(subscription, store.subscriptionPriceHistory, selectedMonth);
      if (!resolved) return [];

      const price = subscriptionPriceForMonth(subscription, store.subscriptionPriceHistory, selectedMonth);
      return [{
        category: subscription.category,
        currency: price.currency,
        amount: subscriptionAmountForBudgetMonth(price.cost, subscription.paymentSchedule),
      }];
    }), [selectedMonth, store.subscriptionPriceHistory, store.subscriptions]);
  const subscriptionFxCurrencies = useMemo(
    () => currenciesRequiringFx(monthlySubscriptionRows.map(row => row.currency)),
    [monthlySubscriptionRows],
  );
  const subscriptionFxCurrencyKey = subscriptionFxCurrencies.join('|');

  useEffect(() => {
    const currencies = subscriptionFxCurrencyKey
      .split('|')
      .filter(Boolean) as Array<Exclude<SubscriptionCurrency, 'GBP'>>;

    if (currencies.length === 0) {
      setSubscriptionFxRates({});
      setSubscriptionFxUnavailableCurrencies([]);
      return;
    }

    let cancelled = false;

    async function loadSubscriptionFxRates() {
      const results = await Promise.all(currencies.map(async currency => {
        try {
          const response = await fetch(exchangeRatePath(currency), { cache: 'no-store' });
          const data = await response.json() as { rateToGbp?: number };
          if (!response.ok || !Number.isFinite(data.rateToGbp)) throw new Error('Exchange rate unavailable.');
          return { currency, rate: data.rateToGbp ?? null };
        } catch {
          return { currency, rate: null };
        }
      }));

      if (cancelled) return;

      setSubscriptionFxRates(Object.fromEntries(
        results
          .filter(result => result.rate !== null)
          .map(result => [result.currency, result.rate]),
      ) as SubscriptionFxRates);
      setSubscriptionFxUnavailableCurrencies(results
        .filter(result => result.rate === null)
        .map(result => result.currency));
    }

    void loadSubscriptionFxRates();

    return () => {
      cancelled = true;
    };
  }, [subscriptionFxCurrencyKey]);

  const subscriptionsByCategory = useMemo(() => {
    const totals = new Map<SubscriptionCategory, number>();

    for (const row of monthlySubscriptionRows) {
      const amountGbp = subscriptionAmountToGbp(row.amount, row.currency, subscriptionFxRates);
      if (amountGbp === null) continue;
      totals.set(row.category, (totals.get(row.category) ?? 0) + amountGbp);
    }

    return [...totals.entries()]
      .map(([category, value]) => ({
        label: category,
        value,
        color: subscriptionCategoryColor(category),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthlySubscriptionRows, subscriptionFxRates]);
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
  const savingsAccountsWithTargets = store.savingsAccounts.filter(
    account => !account.archived && account.targetSavingsAmount !== null && account.targetSavingsAmount > 0,
  );
  const totalSavingsTarget = savingsAccountsWithTargets.reduce(
    (sum, account) => sum + (account.targetSavingsAmount ?? 0),
    0,
  );
  const totalSavingsTargetCurrent = savingsAccountsWithTargets.reduce(
    (sum, account) => sum + account.currentBalance,
    0,
  );
  const wealthTotals = calcWealthForMonth(
    {
      properties: store.properties,
      mortgages: store.mortgages,
      mortgagePayments: store.mortgagePayments,
      savingsAccounts: store.savingsAccounts,
      savingsHistory: store.savingsHistory,
      debts: store.debts,
      debtHistory: store.debtHistory,
      pensions: store.pensions,
      pensionHistory: store.pensionHistory,
      investments: store.investments,
      investmentPurchases: store.investmentPurchases,
      investmentValuationHistory: store.investmentValuationHistory,
    },
    selectedMonth,
    investmentMarketQuotes,
  );

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

  for (const investmentAlert of investmentDropAlerts) {
    alerts.push({
      title: 'Investment value dropped sharply',
      body: `${investmentAlert.name} is down ${Math.round(investmentAlert.dropPct * 100)}% (${fmtCurrency(investmentAlert.dropAmount)}) versus its previous comparison value.`,
      href: `/wealth/investments#${investmentAlert.investmentId}`,
      tone: 'warn',
    });
  }

  for (const subscriptionAlert of subscriptionLifecycleAlerts(store.subscriptions, currentIsoDate())) {
    const event = subscriptionAlert.kind === 'contract' ? 'contract ends' : 'renews';
    alerts.push({
      title: subscriptionAlert.kind === 'contract' ? 'Subscription contract ending soon' : 'Subscription renewal due soon',
      body: `${subscriptionAlert.subscriptionName} ${event} on ${formatLongDateWithOrdinal(subscriptionAlert.date)} (${subscriptionAlert.daysUntil} day${subscriptionAlert.daysUntil === 1 ? '' : 's'} left).`,
      href: '/subscriptions',
      tone: 'info',
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
            <NetWorthTile netWorth={wealthTotals.netWorth} className="min-h-[98px] sm:min-h-[110px]" />

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
            {investmentValueTrend.length > 0 && (
              <InvestmentValueTrendCard
                points={investmentValueTrend}
                footer="Combined investment value versus cost basis from your first logged purchase."
              />
            )}
            {totalSavingsTarget > 0 && (
              <SavingsProgressCard
                currentTotal={totalSavingsTargetCurrent}
                targetTotal={totalSavingsTarget}
                footer={`${savingsAccountsWithTargets.length} account${savingsAccountsWithTargets.length === 1 ? '' : 's'} with savings targets.`}
              />
            )}
            <SubscriptionsByCategoryPieCard
              slices={subscriptionsByCategory}
              footer={
                subscriptionFxUnavailableCurrencies.length > 0
                  ? `Active subscriptions for ${fmtMonth(selectedMonth)}. ${subscriptionFxUnavailableCurrencies.join('/')} prices excluded: FX unavailable.`
                  : `Active subscriptions for ${fmtMonth(selectedMonth)}.`
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}
