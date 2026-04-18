import type { Pot, IncomeSource, IncomeEntry } from './types';
import type { LocalBudget, ResolvedLineItem } from './budgetLogic';

// ─── Output types ─────────────────────────────────────────────────────────────

export interface PotCalc {
  potId:     string;
  pot:       Pot;
  total:     number;   // expenses + savings
  expenses:  number;
  savings:   number;
  items:     ResolvedLineItem[];
}

export interface SourceCalc {
  source:          IncomeSource;
  income:          number;   // sum of IncomeEntry.amount for this source in the budget month
  allocated:       number;   // sum of all pot totals linked to this source
  isOverAllocated: boolean;  // allocated > income
  surplus:         number;   // income - allocated (negative when over)
  pots:            PotCalc[];
}

export interface BudgetCalc {
  potCalcs:    PotCalc[];
  sourceCalcs: SourceCalc[];
  totals: {
    income:    number;
    allocated: number;
    balance:   number;
  };
}

export interface BudgetMetrics {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  totalCommitted: number;
  totalUnallocatedCash: number;
}

export interface BudgetSpendingBreakdown {
  criticalExpenses: number;
  nonCriticalExpenses: number;
  criticalSavings: number;
  nonCriticalSavings: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum IncomeEntry amounts for one source in one YYYY-MM month. */
function incomeForSource(entries: IncomeEntry[], sourceId: string, month: string): number {
  return entries
    .filter(e => e.incomeSourceId === sourceId && e.date.slice(0, 7) === month)
    .reduce((sum, e) => sum + e.amount, 0);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function calcBudget(
  budget:  LocalBudget,
  pots:    Pot[],
  sources: IncomeSource[],
  entries: IncomeEntry[],
): BudgetCalc {
  // 1. Group items by potId
  const byPot = new Map<string, ResolvedLineItem[]>();
  for (const item of budget.items) {
    const list = byPot.get(item.potId) ?? [];
    list.push(item);
    byPot.set(item.potId, list);
  }

  // 2. Build PotCalc for every active pot
  const potCalcs: PotCalc[] = pots
    .filter(p => !p.archived)
    .map(pot => {
      const items    = byPot.get(pot.id) ?? [];
      const expenses = items.filter(i => i.sourceType === 'expense').reduce((s, i) => s + i.amount, 0);
      const savings  = items.filter(i => i.sourceType === 'saving').reduce((s, i)  => s + i.amount, 0);
      return { potId: pot.id, pot, total: expenses + savings, expenses, savings, items };
    });

  // 3. Group PotCalcs by incomeSourceId
  const bySource = new Map<string, PotCalc[]>();
  for (const pc of potCalcs) {
    const list = bySource.get(pc.pot.incomeSourceId) ?? [];
    list.push(pc);
    bySource.set(pc.pot.incomeSourceId, list);
  }

  // 4. Build SourceCalc for every active source
  const sourceCalcs: SourceCalc[] = sources
    .filter(s => !s.archived)
    .map(source => {
      const sourcePots = bySource.get(source.id) ?? [];
      const income     = incomeForSource(entries, source.id, budget.month);
      const allocated  = sourcePots.reduce((s, pc) => s + pc.total, 0);
      return {
        source,
        income,
        allocated,
        isOverAllocated: allocated > income,
        surplus: income - allocated,
        pots: sourcePots,
      };
    });

  // 5. Roll up totals
  const totalIncome    = sourceCalcs.reduce((s, sc) => s + sc.income,    0);
  const totalAllocated = sourceCalcs.reduce((s, sc) => s + sc.allocated, 0);

  return {
    potCalcs,
    sourceCalcs,
    totals: { income: totalIncome, allocated: totalAllocated, balance: totalIncome - totalAllocated },
  };
}

export function findBudgetForMonth(
  budgets: LocalBudget[],
  month: string,
): LocalBudget | null {
  return budgets.find(budget => budget.month === month && !budget.archived) ?? null;
}

export function calcBudgetMetrics(calc: BudgetCalc): BudgetMetrics {
  const totalIncome = calc.totals.income;
  const totalExpenses = calc.potCalcs.reduce((sum, potCalc) => sum + potCalc.expenses, 0);
  const totalSavings = calc.potCalcs.reduce((sum, potCalc) => sum + potCalc.savings, 0);
  const totalCommitted = totalExpenses + totalSavings;

  return {
    totalIncome,
    totalExpenses,
    totalSavings,
    totalCommitted,
    totalUnallocatedCash: totalIncome - totalCommitted,
  };
}

export function calcBudgetMetricsForMonth(
  month: string,
  budgets: LocalBudget[],
  pots: Pot[],
  sources: IncomeSource[],
  entries: IncomeEntry[],
): BudgetMetrics {
  const budget = findBudgetForMonth(budgets, month);

  if (!budget) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      totalCommitted: 0,
      totalUnallocatedCash: 0,
    };
  }

  const activePots = pots.filter(pot => !pot.archived);
  return calcBudgetMetrics(calcBudget(budget, activePots, sources, entries));
}

export function calcAverageBudgetMetrics(
  budgets: LocalBudget[],
  pots: Pot[],
  sources: IncomeSource[],
  entries: IncomeEntry[],
): BudgetMetrics {
  const activeBudgets = budgets.filter(budget => !budget.archived);

  if (activeBudgets.length === 0) {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      totalCommitted: 0,
      totalUnallocatedCash: 0,
    };
  }

  const activePots = pots.filter(pot => !pot.archived);
  const totals = activeBudgets.reduce<BudgetMetrics>((sum, budget) => {
    const metrics = calcBudgetMetrics(calcBudget(budget, activePots, sources, entries));
    return {
      totalIncome: sum.totalIncome + metrics.totalIncome,
      totalExpenses: sum.totalExpenses + metrics.totalExpenses,
      totalSavings: sum.totalSavings + metrics.totalSavings,
      totalCommitted: sum.totalCommitted + metrics.totalCommitted,
      totalUnallocatedCash: sum.totalUnallocatedCash + metrics.totalUnallocatedCash,
    };
  }, {
    totalIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    totalCommitted: 0,
    totalUnallocatedCash: 0,
  });

  return {
    totalIncome: totals.totalIncome / activeBudgets.length,
    totalExpenses: totals.totalExpenses / activeBudgets.length,
    totalSavings: totals.totalSavings / activeBudgets.length,
    totalCommitted: totals.totalCommitted / activeBudgets.length,
    totalUnallocatedCash: totals.totalUnallocatedCash / activeBudgets.length,
  };
}

export function calcBudgetSpendingBreakdown(calc: BudgetCalc): BudgetSpendingBreakdown {
  return calc.potCalcs.reduce<BudgetSpendingBreakdown>((sum, potCalc) => {
    for (const item of potCalc.items) {
      if (item.sourceType === 'expense') {
        if (item.isCritical) {
          sum.criticalExpenses += item.amount;
        } else {
          sum.nonCriticalExpenses += item.amount;
        }
        continue;
      }

      if (item.isCritical) {
        sum.criticalSavings += item.amount;
      } else {
        sum.nonCriticalSavings += item.amount;
      }
    }

    return sum;
  }, {
    criticalExpenses: 0,
    nonCriticalExpenses: 0,
    criticalSavings: 0,
    nonCriticalSavings: 0,
  });
}

export function calcBudgetSpendingBreakdownForMonth(
  month: string,
  budgets: LocalBudget[],
  pots: Pot[],
  sources: IncomeSource[],
  entries: IncomeEntry[],
): BudgetSpendingBreakdown {
  const budget = findBudgetForMonth(budgets, month);

  if (!budget) {
    return {
      criticalExpenses: 0,
      nonCriticalExpenses: 0,
      criticalSavings: 0,
      nonCriticalSavings: 0,
    };
  }

  const activePots = pots.filter(pot => !pot.archived);
  return calcBudgetSpendingBreakdown(calcBudget(budget, activePots, sources, entries));
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getPotCalc(calc: BudgetCalc, potId: string): PotCalc | undefined {
  return calc.potCalcs.find(pc => pc.potId === potId);
}

export function getSourceCalcForPot(calc: BudgetCalc, potId: string): SourceCalc | undefined {
  return calc.sourceCalcs.find(sc => sc.pots.some(pc => pc.potId === potId));
}
