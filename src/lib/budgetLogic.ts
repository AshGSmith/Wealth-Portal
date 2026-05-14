import type {
  Expense,
  Saving,
  SavingAmountHistory,
  Subscription,
  SubscriptionPriceHistory,
  Mortgage,
  PotId,
  IncomeSourceId,
  IncomeSourceType,
} from './types';
import { subscriptionCancellationCutoff } from './subscriptionCalc';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedLineItem {
  id:           string;         // "expense-e1" | "saving-s1"
  sourceType:   'expense' | 'saving';
  sourceId:     string;
  incomeSourceId: IncomeSourceId;
  defaultIncomeSourceId: IncomeSourceId;
  incomeSourceName: string;
  ownerUserIds: string[];
  defaultOwnerUserIds: string[];
  name:         string;
  amount:       number;
  potId:        PotId;          // current assignment — may be overridden
  defaultPotId: PotId;          // original from the source record
  potName:      string;
  isCritical:   boolean;
}

export interface LockedBudgetPotCalcSnapshot {
  potId: string;
  potName: string;
  potIsBusiness: boolean;
  total: number;
  expenses: number;
  savings: number;
  items: ResolvedLineItem[];
}

export interface LockedBudgetSourceCalcSnapshot {
  sourceId: string;
  provider: string;
  sourceType: IncomeSourceType;
  income: number;
  allocated: number;
  isOverAllocated: boolean;
  surplus: number;
  potIds: string[];
}

export interface LockedBudgetSnapshot {
  potCalcs: LockedBudgetPotCalcSnapshot[];
  sourceCalcs: LockedBudgetSourceCalcSnapshot[];
  totals: {
    income: number;
    allocated: number;
    balance: number;
  };
}

export interface LocalBudget {
  id:       string;
  month:    string;   // YYYY-MM
  archived: boolean;
  locked:   boolean;
  ownerUserIds: string[];
  items:    ResolvedLineItem[];
  lockedSnapshot?: LockedBudgetSnapshot | null;
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
    incomeSourceName: '',
    ownerUserIds: e.ownerUserIds,
    defaultOwnerUserIds: e.ownerUserIds,
    name:         e.name,
    amount:       e.amount,
    potId:        e.potId,
    defaultPotId: e.potId,
    potName:      '',
    isCritical:   e.isCritical,
  };
}

function monthlyEquivalent(amount: number, schedule: Subscription['paymentSchedule']): number {
  if (schedule === 'Weekly') return (amount * 52) / 12;
  return amount;
}

export function subscriptionPriceForMonth(
  subscription: Subscription,
  history: SubscriptionPriceHistory[],
  month: string,
): { cost: number; currency: Subscription['currency'] } {
  const match = history
    .filter(entry => entry.subscriptionId === subscription.id && entry.effectiveDate.slice(0, 7) <= month)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .at(-1);

  return {
    cost: match?.cost ?? subscription.cost,
    currency: match?.currency ?? subscription.currency,
  };
}

function toResolvedSubscriptionItem(
  subscription: Subscription,
  amount: number,
): ResolvedLineItem {
  return {
    id: `subscription-${subscription.id}`,
    sourceType: 'expense',
    sourceId: subscription.id,
    incomeSourceId: subscription.incomeSourceId,
    defaultIncomeSourceId: subscription.incomeSourceId,
    incomeSourceName: '',
    ownerUserIds: subscription.ownerUserIds,
    defaultOwnerUserIds: subscription.ownerUserIds,
    name: subscription.name,
    amount,
    potId: subscription.potId,
    defaultPotId: subscription.potId,
    potName: '',
    isCritical: subscription.isCriticalExpense,
  };
}

function daysInMonth(month: string): number {
  const [yearPart, monthPart] = month.split('-').map(Number);
  return new Date(yearPart, monthPart, 0).getDate();
}

export function mortgagePaymentAmountForMonth(mortgage: Mortgage, month: string): number {
  if (!mortgage.proRataFirstPayment || !mortgage.startDate || mortgage.startDate.slice(0, 7) !== month) {
    return mortgage.monthlyPaymentAmount;
  }

  const startDay = Number(mortgage.startDate.slice(8, 10));
  const lastDay = daysInMonth(month);
  const paymentDay = Math.min(Math.max(mortgage.paymentDay, 1), lastDay);
  const chargeableDays = paymentDay >= startDay
    ? paymentDay - startDay + 1
    : lastDay - startDay + 1;
  return mortgage.monthlyPaymentAmount * (Math.max(chargeableDays, 0) / lastDay);
}

export function resolveMortgageForMonth(
  mortgage: Mortgage,
  month: string,
): ResolvedLineItem | null {
  if (mortgage.archived) return null;
  if (!mortgage.startDate || mortgage.startDate.slice(0, 7) > month) return null;
  if (!mortgage.potId || !mortgage.incomeSourceId || mortgage.monthlyPaymentAmount <= 0) return null;

  return {
    id: `mortgage-${mortgage.id}`,
    sourceType: 'expense',
    sourceId: mortgage.id,
    incomeSourceId: mortgage.incomeSourceId,
    defaultIncomeSourceId: mortgage.incomeSourceId,
    incomeSourceName: '',
    ownerUserIds: mortgage.ownerUserIds,
    defaultOwnerUserIds: mortgage.ownerUserIds,
    name: mortgage.lender,
    amount: mortgagePaymentAmountForMonth(mortgage, month),
    potId: mortgage.potId,
    defaultPotId: mortgage.potId,
    potName: '',
    isCritical: mortgage.isCriticalExpense,
  };
}

export function resolveSubscriptionForMonth(
  subscription: Subscription,
  history: SubscriptionPriceHistory[],
  month: string,
): ResolvedLineItem | null {
  if (subscription.archived) return null;
  if (subscription.paymentDate.slice(0, 7) > month) return null;
  const cancellationCutoff = subscriptionCancellationCutoff(subscription);
  if (subscription.status === 'Cancelled' && cancellationCutoff && cancellationCutoff.slice(0, 7) < month) return null;

  if (subscription.paymentSchedule === 'Yearly') {
    const dueMonth = subscription.paymentDate.slice(5, 7);
    if (month.slice(5, 7) !== dueMonth) return null;
  }

  const price = subscriptionPriceForMonth(subscription, history, month);
  return toResolvedSubscriptionItem(subscription, monthlyEquivalent(price.cost, subscription.paymentSchedule));
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
  savingAmountHistory: SavingAmountHistory[] = [],
  subscriptions: Subscription[] = [],
  subscriptionPriceHistory: SubscriptionPriceHistory[] = [],
  mortgages: Mortgage[] = [],
): ResolvedLineItem[] {
  const out: ResolvedLineItem[] = [];

  for (const e of expenses) {
    const resolved = resolveExpenseForMonth(e, month);
    if (resolved) out.push(resolved);
  }

  for (const subscription of subscriptions) {
    const resolved = resolveSubscriptionForMonth(subscription, subscriptionPriceHistory, month);
    if (resolved) out.push(resolved);
  }

  for (const mortgage of mortgages) {
    const resolved = resolveMortgageForMonth(mortgage, month);
    if (resolved) out.push(resolved);
  }

  for (const s of savings) {
    if (!s.archived && isActiveInMonth(s, month)) {
      const effectiveAmount = savingAmountForMonth(s, savingAmountHistory, month);
      out.push({
        id:           `saving-${s.id}`,
        sourceType:   'saving',
        sourceId:     s.id,
        incomeSourceId: s.incomeSourceId,
        defaultIncomeSourceId: s.incomeSourceId,
        incomeSourceName: '',
        ownerUserIds: s.ownerUserIds,
        defaultOwnerUserIds: s.ownerUserIds,
        name:         s.name,
        amount:       effectiveAmount,
        potId:        s.potId,
        defaultPotId: s.potId,
        potName:      '',
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
  savingAmountHistory: SavingAmountHistory[] = [],
  subscriptions: Subscription[] = [],
  subscriptionPriceHistory: SubscriptionPriceHistory[] = [],
  mortgages: Mortgage[] = [],
): LocalBudget {
  const preparedExpenses = applyPendingOneOffExpensesToBudgetMonth(month, expenses);
  const items = resolveItemsForMonth(month, preparedExpenses, savings, savingAmountHistory, subscriptions, subscriptionPriceHistory, mortgages);

  return {
    id:       `budget-${Date.now()}`,
    month,
    archived: false,
    locked:   false,
    ownerUserIds: [...new Set(items.flatMap(item => item.ownerUserIds))],
    items,
    lockedSnapshot: null,
  };
}

export function refreshBudget(
  budget: LocalBudget,
  expenses: Expense[],
  savings: Saving[],
  savingAmountHistory: SavingAmountHistory[] = [],
  subscriptions: Subscription[] = [],
  subscriptionPriceHistory: SubscriptionPriceHistory[] = [],
  mortgages: Mortgage[] = [],
): LocalBudget {
  if (budget.locked) {
    return budget;
  }

  const nextResolvedItems = resolveItemsForMonth(
    budget.month,
    applyPendingOneOffExpensesToBudgetMonth(budget.month, expenses),
    savings,
    savingAmountHistory,
    subscriptions,
    subscriptionPriceHistory,
    mortgages,
  );
  const existingItemsById = new Map(budget.items.map(item => [item.id, item]));

  return {
    ...budget,
    items: nextResolvedItems.map(item => {
      const existingItem = existingItemsById.get(item.id);
      if (!existingItem) return item;

      return {
        ...item,
        potId: existingItem.potId,
        incomeSourceId: existingItem.incomeSourceId,
        ownerUserIds: existingItem.ownerUserIds,
      };
    }),
    ownerUserIds: [...new Set(nextResolvedItems.flatMap(item => {
      const existingItem = existingItemsById.get(item.id);
      return existingItem?.ownerUserIds ?? item.ownerUserIds;
    }))],
    lockedSnapshot: budget.locked ? budget.lockedSnapshot ?? null : null,
  };
}

export function savingAmountForMonth(
  saving: Saving,
  history: SavingAmountHistory[],
  month: string,
): number {
  const match = history
    .filter(entry => entry.savingId === saving.id && entry.effectiveDate.slice(0, 7) <= month)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
    .at(-1);

  return match?.amount ?? saving.amount;
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

  return {
    ...budget,
    ownerUserIds: [...new Set(items.flatMap(item => item.ownerUserIds))],
    items,
  };
}
