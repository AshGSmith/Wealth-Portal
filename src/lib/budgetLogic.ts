import type { Expense, Saving, PotId, IncomeSourceId } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedLineItem {
  id:           string;         // "expense-e1" | "saving-s1"
  sourceType:   'expense' | 'saving';
  sourceId:     string;
  incomeSourceId: IncomeSourceId;
  defaultIncomeSourceId: IncomeSourceId;
  ownerUserIds: string[];
  defaultOwnerUserIds: string[];
  name:         string;
  amount:       number;
  potId:        PotId;          // current assignment — may be overridden
  defaultPotId: PotId;          // original from the source record
  isCritical:   boolean;
}

export interface LocalBudget {
  id:       string;
  month:    string;   // YYYY-MM
  archived: boolean;
  locked:   boolean;
  items:    ResolvedLineItem[];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYM(date: string): string {
  return date.slice(0, 7); // "YYYY-MM-DD" → "YYYY-MM"
}

/**
 * Returns true when a line item is active during `month`.
 *
 * Rules (per spec):
 *   startDate <= budget month  OR startDate is null
 *   endDate   >= budget month  OR endDate is null
 */
export function isActiveInMonth(
  item: { startDate: string | null; endDate: string | null },
  month: string,
): boolean {
  if (item.startDate && toYM(item.startDate) > month) return false;
  if (item.endDate   && toYM(item.endDate)   < month) return false;
  return true;
}

function toResolvedExpenseItem(e: Expense): ResolvedLineItem {
  return {
    id:           `expense-${e.id}`,
    sourceType:   'expense',
    sourceId:     e.id,
    incomeSourceId: e.incomeSourceId,
    defaultIncomeSourceId: e.incomeSourceId,
    ownerUserIds: e.ownerUserIds,
    defaultOwnerUserIds: e.ownerUserIds,
    name:         e.name,
    amount:       e.amount,
    potId:        e.potId,
    defaultPotId: e.potId,
    isCritical:   e.isCritical,
  };
}

export function resolveExpenseForMonth(
  expense: Expense,
  month: string,
): ResolvedLineItem | null {
  if (expense.archived) return null;

  if (expense.oneOffPayment) {
    return expense.oneOffAppliedBudgetMonth === month
      ? toResolvedExpenseItem(expense)
      : null;
  }

  return isActiveInMonth(expense, month)
    ? toResolvedExpenseItem(expense)
    : null;
}

export function applyPendingOneOffExpensesToBudgetMonth(
  month: string,
  expenses: Expense[],
): Expense[] {
  return expenses.map(expense =>
    !expense.archived && expense.oneOffPayment && !expense.oneOffAppliedBudgetMonth
      ? { ...expense, oneOffAppliedBudgetMonth: month }
      : expense
  );
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export function resolveItemsForMonth(
  month: string,
  expenses: Expense[],
  savings:  Saving[],
): ResolvedLineItem[] {
  const out: ResolvedLineItem[] = [];

  for (const e of expenses) {
    const resolved = resolveExpenseForMonth(e, month);
    if (resolved) out.push(resolved);
  }

  for (const s of savings) {
    if (!s.archived && isActiveInMonth(s, month)) {
      out.push({
        id:           `saving-${s.id}`,
        sourceType:   'saving',
        sourceId:     s.id,
        incomeSourceId: s.incomeSourceId,
        defaultIncomeSourceId: s.incomeSourceId,
        ownerUserIds: s.ownerUserIds,
        defaultOwnerUserIds: s.ownerUserIds,
        name:         s.name,
        amount:       s.amount,
        potId:        s.potId,
        defaultPotId: s.potId,
        isCritical:   s.isCritical,
      });
    }
  }

  return out;
}

export function createBudget(
  month: string,
  expenses: Expense[],
  savings:  Saving[],
): LocalBudget {
  const preparedExpenses = applyPendingOneOffExpensesToBudgetMonth(month, expenses);

  return {
    id:       `budget-${Date.now()}`,
    month,
    archived: false,
    locked:   false,
    items:    resolveItemsForMonth(month, preparedExpenses, savings),
  };
}

export function sanitizeBudgetForOneOffExpenses(
  budget: LocalBudget,
  expenses: Expense[],
): LocalBudget {
  const oneOffExpenses = expenses.filter(expense => expense.oneOffPayment);
  const oneOffById = new Map(oneOffExpenses.map(expense => [expense.id as string, expense]));
  const seenItemIds = new Set<string>();
  const items: ResolvedLineItem[] = [];

  for (const item of budget.items) {
    if (seenItemIds.has(item.id)) continue;

    if (item.sourceType === 'expense') {
      const expense = oneOffById.get(item.sourceId);
      if (expense) {
        const resolved = resolveExpenseForMonth(expense, budget.month);
        if (!resolved) continue;

        items.push({
          ...resolved,
          potId: item.potId,
          incomeSourceId: item.incomeSourceId,
          ownerUserIds: item.ownerUserIds,
        });
        seenItemIds.add(item.id);
        continue;
      }
    }

    items.push(item);
    seenItemIds.add(item.id);
  }

  for (const expense of oneOffExpenses) {
    const resolved = resolveExpenseForMonth(expense, budget.month);
    if (resolved && !seenItemIds.has(resolved.id)) {
      items.push(resolved);
      seenItemIds.add(resolved.id);
    }
  }

  return { ...budget, items };
}
