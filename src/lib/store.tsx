'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  MOCK_INCOME_SOURCES,
  MOCK_INCOME_ENTRIES,
  MOCK_SALARY_HISTORY,
  MOCK_POTS,
  MOCK_EXPENSES,
  MOCK_SAVINGS,
  MOCK_BUDGETS,
  MOCK_MORTGAGES,
  MOCK_MORTGAGE_PAYMENTS,
  MOCK_PROPERTIES,
  MOCK_SAVINGS_ACCOUNTS,
  MOCK_SAVINGS_HISTORY,
  MOCK_DEBTS,
  MOCK_DEBT_TRANSACTIONS,
  MOCK_DEBT_HISTORY,
  MOCK_PENSIONS,
  MOCK_PENSION_HISTORY,
} from '@/lib/mock';
import {
  applyPendingOneOffExpensesToBudgetMonth,
  createBudget,
  resolveExpenseForMonth,
  sanitizeBudgetForOneOffExpenses,
  type LocalBudget,
} from '@/lib/budgetLogic';
import type {
  IncomeSource, IncomeEntry, Pot, Expense, Saving, SalaryHistory,
  Mortgage, MortgagePayment, Property,
  SavingsAccount, SavingsHistory,
  Debt, DebtHistory, DebtTransaction,
  Pension, PensionHistory,
  PotId,
  IncomeSourceId,
} from '@/lib/types';

// ─── localStorage helpers ─────────────────────────────────────────────────────

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded or SSR */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppStore {
  hydrated: boolean;

  // Budget
  budgets:           LocalBudget[];
  activeBudgetMonth: string;
  sources:           IncomeSource[];
  entries:           IncomeEntry[];
  salaryHistory:     SalaryHistory[];
  pots:              Pot[];
  expenses:          Expense[];
  savings:           Saving[];

  upsertBudget:         (b: LocalBudget) => void;
  createBudgetForMonth: (month: string) => void;
  moveBudgetItem:       (month: string, itemId: string, newPotId: PotId) => void;
  setBudgetItemIncomeSource: (month: string, itemId: string, incomeSourceId: string) => void;
  setActiveBudgetMonth: (month: string) => void;
  deleteBudget:         (month: string) => void;
  setBudgetArchived:    (month: string, archived: boolean) => void;
  setBudgetLocked:      (month: string, locked: boolean)   => void;

  upsertSource:  (s: IncomeSource) => void;
  upsertEntry:   (e: IncomeEntry)  => void;
  upsertSalaryHistory: (h: SalaryHistory) => void;
  removeSalaryHistory: (id: string) => void;
  upsertPot:     (p: Pot)          => void;
  upsertExpense: (e: Expense)      => void;
  upsertSaving:  (s: Saving)       => void;

  setSourceArchived:  (id: string, archived: boolean) => void;
  removeEntry:        (id: string) => void;
  setPotArchived:     (id: string, archived: boolean) => void;
  setExpenseArchived: (id: string, archived: boolean) => void;
  setSavingArchived:  (id: string, archived: boolean) => void;

  // Wealth
  mortgages:       Mortgage[];
  mortgagePayments: MortgagePayment[];
  properties:      Property[];
  savingsAccounts: SavingsAccount[];
  savingsHistory:  SavingsHistory[];
  debts:           Debt[];
  debtTransactions: DebtTransaction[];
  debtHistory:     DebtHistory[];
  pensions:        Pension[];
  pensionHistory:  PensionHistory[];

  upsertMortgage:        (m: Mortgage)        => void;
  upsertMortgagePayment: (p: MortgagePayment) => void;
  removeMortgagePayment: (id: string)         => void;
  upsertProperty:        (p: Property)        => void;
  upsertSavingsAccount:  (a: SavingsAccount)  => void;
  upsertSavingsHistory:  (h: SavingsHistory)  => void;
  removeSavingsHistory:  (id: string)         => void;
  upsertDebt:            (d: Debt)            => void;
  upsertDebtTransaction: (t: DebtTransaction) => void;
  removeDebtTransaction: (id: string)         => void;
  upsertDebtHistory:     (h: DebtHistory)     => void;
  removeDebtHistory:     (id: string)         => void;
  upsertPension:         (p: Pension)         => void;
  upsertPensionHistory:  (h: PensionHistory)  => void;
  removePensionHistory:  (id: string)         => void;

  setMortgageArchived:      (id: string, archived: boolean) => void;
  setPropertyArchived:      (id: string, archived: boolean) => void;
  setSavingsAccountArchived:(id: string, archived: boolean) => void;
  setDebtArchived:          (id: string, archived: boolean) => void;
  setPensionArchived:       (id: string, archived: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function upsert<T extends { id: string }>(prev: T[], item: T): T[] {
  const idx = prev.findIndex(x => x.id === item.id);
  return idx >= 0 ? prev.map(x => x.id === item.id ? item : x) : [...prev, item];
}

function setArchived<T extends { id: string; archived: boolean }>(
  prev: T[], id: string, archived: boolean,
): T[] {
  return prev.map(x => x.id === id ? { ...x, archived } : x);
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function normalizeIncomeSource(source: IncomeSource): IncomeSource {
  return {
    ...source,
    startingAnnualSalary: source.startingAnnualSalary ?? null,
  };
}

function normalizeIncomeSources(sources: IncomeSource[]): IncomeSource[] {
  return sources.map(normalizeIncomeSource);
}

function normalizePot(pot: Pot): Pot {
  return {
    id: pot.id,
    name: pot.name,
    isBusiness: pot.isBusiness ?? false,
    archived: pot.archived,
  };
}

function normalizePots(pots: Pot[]): Pot[] {
  return pots.map(normalizePot);
}

function normalizeSalaryHistoryEntry(entry: SalaryHistory): SalaryHistory {
  return {
    ...entry,
    note: entry.note ?? null,
  };
}

function normalizeSalaryHistory(entries: SalaryHistory[]): SalaryHistory[] {
  return entries.map(normalizeSalaryHistoryEntry);
}

function normalizeProviderName(value: string): string {
  return value.trim().toLowerCase();
}

function isNamedIncomeSource(source: IncomeSource, providerName: string): boolean {
  return normalizeProviderName(source.provider) === normalizeProviderName(providerName);
}

function migrateIncomeSourceProvider(
  sources: IncomeSource[],
  entries: IncomeEntry[],
  salaryHistory: SalaryHistory[],
  expenses: Expense[],
  savings: Saving[],
  budgets: LocalBudget[],
): {
  sources: IncomeSource[];
  entries: IncomeEntry[];
  salaryHistory: SalaryHistory[];
  expenses: Expense[];
  savings: Saving[];
  budgets: LocalBudget[];
} {
  const acmeSources = sources.filter(source => isNamedIncomeSource(source, 'ACME Corp'));
  if (acmeSources.length === 0) {
    return { sources, entries, salaryHistory, expenses, savings, budgets };
  }

  const existingCivicaSource = sources.find(source => isNamedIncomeSource(source, 'Civica')) ?? null;
  const targetSource = existingCivicaSource ?? acmeSources[0];
  const sourceIdsToReplace = new Set(
    acmeSources
      .map(source => source.id)
      .filter(sourceId => sourceId !== targetSource.id),
  );

  const remapIncomeSourceId = (incomeSourceId: IncomeSourceId): IncomeSourceId =>
    sourceIdsToReplace.has(incomeSourceId)
      ? targetSource.id
      : incomeSourceId;

  return {
    sources: sources
      .filter(source => !sourceIdsToReplace.has(source.id))
      .map(source => (
        source.id === targetSource.id
          ? { ...source, provider: 'Civica' }
          : source
      )),
    entries: entries.map(entry => ({
      ...entry,
      incomeSourceId: remapIncomeSourceId(entry.incomeSourceId),
    })),
    salaryHistory: salaryHistory.map(entry => ({
      ...entry,
      incomeSourceId: remapIncomeSourceId(entry.incomeSourceId),
    })),
    expenses: expenses.map(expense => ({
      ...expense,
      incomeSourceId: remapIncomeSourceId(expense.incomeSourceId),
    })),
    savings: savings.map(saving => ({
      ...saving,
      incomeSourceId: remapIncomeSourceId(saving.incomeSourceId),
    })),
    budgets: budgets.map(budget => ({
      ...budget,
      items: budget.items.map(item => ({
        ...item,
        incomeSourceId: remapIncomeSourceId(item.incomeSourceId),
        defaultIncomeSourceId: remapIncomeSourceId(item.defaultIncomeSourceId),
      })),
    })),
  };
}

function normalizeExpense(expense: Expense): Expense {
  return {
    ...expense,
    oneOffPayment: expense.oneOffPayment ?? false,
    oneOffAppliedBudgetMonth: expense.oneOffAppliedBudgetMonth ?? null,
  };
}

function normalizeExpenseWithSource(
  expense: Expense & { incomeSourceId?: string | null },
  pots: Array<Pot & { incomeSourceId?: string }>,
): Expense {
  const linkedPot = pots.find(pot => pot.id === expense.potId);
  return {
    ...normalizeExpense(expense),
    incomeSourceId: (expense.incomeSourceId ?? linkedPot?.incomeSourceId ?? '') as Expense['incomeSourceId'],
  };
}

function normalizeSavingWithSource(
  saving: Saving & { incomeSourceId?: string | null },
  pots: Array<Pot & { incomeSourceId?: string }>,
): Saving {
  const linkedPot = pots.find(pot => pot.id === saving.potId);
  return {
    ...saving,
    incomeSourceId: (saving.incomeSourceId ?? linkedPot?.incomeSourceId ?? '') as Saving['incomeSourceId'],
  };
}

function normalizeBudgets(budgets: LocalBudget[], expenses: Expense[]): LocalBudget[] {
  return budgets.map(budget => sanitizeBudgetForOneOffExpenses(budget, expenses));
}

function normalizeDebt(debt: Debt & { type?: 'loan' | 'credit-card' }): Debt {
  return {
    ...debt,
    debtType: debt.debtType ?? debt.type ?? 'loan',
    borrowedAmount: debt.borrowedAmount ?? null,
    termMonths: debt.termMonths ?? null,
    startDate: debt.startDate ?? null,
  };
}

function normalizeDebts(debts: Debt[]): Debt[] {
  return debts.map(normalizeDebt);
}

function normalizeDebtHistoryEntry(entry: DebtHistory): DebtHistory {
  return {
    ...entry,
    type: entry.type ?? 'snapshot',
    amount: entry.amount ?? null,
    note: entry.note ?? null,
  };
}

function normalizeDebtHistory(entries: DebtHistory[]): DebtHistory[] {
  return entries.map(normalizeDebtHistoryEntry);
}

function normalizeDebtTransaction(entry: DebtTransaction): DebtTransaction {
  return {
    ...entry,
    note: entry.note ?? null,
  };
}

function normalizeDebtTransactions(entries: DebtTransaction[]): DebtTransaction[] {
  return entries.map(normalizeDebtTransaction);
}

function applyDebtTransactionToBalance(balance: number, transaction: DebtTransaction): number {
  return transaction.type === 'purchase'
    ? balance + transaction.amount
    : Math.max(0, balance - transaction.amount);
}

function syncOneOffExpenseIntoBudget(
  budget: LocalBudget,
  expense: Expense,
): LocalBudget {
  const resolved = resolveExpenseForMonth(expense, budget.month);
  const itemId = `expense-${expense.id}`;

  if (!resolved) {
    return budget;
  }

  const hasItem = budget.items.some(item => item.id === itemId);
  return {
    ...budget,
    items: hasItem
      ? budget.items.map(item => item.id === itemId ? resolved : item)
      : [...budget.items, resolved],
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Initialize from MOCK data so server and client render identical HTML (no hydration mismatch).
  // localStorage is loaded in the effect below, after hydration.
  const [hydrated,          setHydrated]          = useState(false);
  const [budgets,           setBudgets]           = useState<LocalBudget[]>(MOCK_BUDGETS);
  const [activeBudgetMonth, setActiveBudgetMonth] = useState('2026-04');
  const [sources,           setSources]           = useState<IncomeSource[]>(MOCK_INCOME_SOURCES);
  const [entries,           setEntries]           = useState<IncomeEntry[]> (MOCK_INCOME_ENTRIES);
  const [salaryHistory,     setSalaryHistory]     = useState<SalaryHistory[]>(MOCK_SALARY_HISTORY);
  const [pots,              setPots]              = useState<Pot[]>         (MOCK_POTS);
  const [expenses,          setExpenses]          = useState<Expense[]>     (MOCK_EXPENSES);
  const [savings,           setSavings]           = useState<Saving[]>      (MOCK_SAVINGS);

  // Wealth state
  const [mortgages,        setMortgages]        = useState<Mortgage[]>       (MOCK_MORTGAGES);
  const [mortgagePayments, setMortgagePayments] = useState<MortgagePayment[]>(MOCK_MORTGAGE_PAYMENTS);
  const [properties,       setProperties]       = useState<Property[]>       (MOCK_PROPERTIES);
  const [savingsAccounts,  setSavingsAccounts]  = useState<SavingsAccount[]> (MOCK_SAVINGS_ACCOUNTS);
  const [savingsHistory,   setSavingsHistory]   = useState<SavingsHistory[]> (MOCK_SAVINGS_HISTORY);
  const [debts,            setDebts]            = useState<Debt[]>           (MOCK_DEBTS);
  const [debtTransactions, setDebtTransactions] = useState<DebtTransaction[]>(MOCK_DEBT_TRANSACTIONS);
  const [debtHistory,      setDebtHistory]      = useState<DebtHistory[]>    (MOCK_DEBT_HISTORY);
  const [pensions,         setPensions]         = useState<Pension[]>        (MOCK_PENSIONS);
  const [pensionHistory,   setPensionHistory]   = useState<PensionHistory[]> (MOCK_PENSION_HISTORY);

  // Runs once on the client after hydration — safe to access localStorage here.
  useEffect(() => {
    const loadedBudgets = load('wmp:budgets', MOCK_BUDGETS);
    const loadedSources = normalizeIncomeSources(load('wmp:sources', MOCK_INCOME_SOURCES));
    const loadedEntries = load('wmp:entries', MOCK_INCOME_ENTRIES);
    const loadedSalaryHistory = normalizeSalaryHistory(load('wmp:salaryHistory', MOCK_SALARY_HISTORY));
    const loadedPots = load('wmp:pots', MOCK_POTS) as Array<Pot & { incomeSourceId?: string }>;
    const loadedExpenses = load('wmp:expenses', MOCK_EXPENSES) as Array<Expense & { incomeSourceId?: string | null }>;
    const loadedSavings = load('wmp:savings', MOCK_SAVINGS) as Array<Saving & { incomeSourceId?: string | null }>;
    const normalizedPots = normalizePots(loadedPots);
    const normalizedExpenses = loadedExpenses.map(expense => normalizeExpenseWithSource(expense, loadedPots));
    const normalizedSavings = loadedSavings.map(saving => normalizeSavingWithSource(saving, loadedPots));
    const migratedIncomeData = migrateIncomeSourceProvider(
      loadedSources,
      loadedEntries,
      loadedSalaryHistory,
      normalizedExpenses,
      normalizedSavings,
      loadedBudgets,
    );

    setBudgets          (normalizeBudgets(migratedIncomeData.budgets, migratedIncomeData.expenses));
    setActiveBudgetMonth(load('wmp:activeBudgetMonth', '2026-04'));
    setSources          (migratedIncomeData.sources);
    setEntries          (migratedIncomeData.entries);
    setSalaryHistory    (migratedIncomeData.salaryHistory);
    setPots             (normalizedPots);
    setExpenses         (migratedIncomeData.expenses);
    setSavings          (migratedIncomeData.savings);
    setMortgages        (load('wmp:mortgages',         MOCK_MORTGAGES));
    setMortgagePayments (load('wmp:mortgagePayments',  MOCK_MORTGAGE_PAYMENTS));
    setProperties       (load('wmp:properties',        MOCK_PROPERTIES));
    setSavingsAccounts  (load('wmp:savingsAccounts',   MOCK_SAVINGS_ACCOUNTS));
    setSavingsHistory   (load('wmp:savingsHistory',    MOCK_SAVINGS_HISTORY));
    const loadedDebts = normalizeDebts(load('wmp:debts', MOCK_DEBTS));
    const loadedDebtTransactions = normalizeDebtTransactions(load('wmp:debtTransactions', MOCK_DEBT_TRANSACTIONS));
    setDebts            (loadedDebts);
    setDebtTransactions (loadedDebtTransactions);
    setDebtHistory      (normalizeDebtHistory(load('wmp:debtHistory', MOCK_DEBT_HISTORY)));
    setPensions         (load('wmp:pensions',          MOCK_PENSIONS));
    setPensionHistory   (load('wmp:pensionHistory',    MOCK_PENSION_HISTORY));
    setHydrated(true);
  }, []);

  // Only persist after hydration so we don't overwrite stored data with MOCK data
  // during the initial effect flush.
  useEffect(() => { if (hydrated) save('wmp:budgets',           budgets);           }, [budgets,           hydrated]);
  useEffect(() => { if (hydrated) save('wmp:activeBudgetMonth', activeBudgetMonth); }, [activeBudgetMonth, hydrated]);
  useEffect(() => { if (hydrated) save('wmp:sources',           sources);           }, [sources,          hydrated]);
  useEffect(() => { if (hydrated) save('wmp:entries',           entries);          }, [entries,          hydrated]);
  useEffect(() => { if (hydrated) save('wmp:salaryHistory',     salaryHistory);    }, [salaryHistory,    hydrated]);
  useEffect(() => { if (hydrated) save('wmp:pots',              pots);             }, [pots,             hydrated]);
  useEffect(() => { if (hydrated) save('wmp:expenses',          expenses);         }, [expenses,         hydrated]);
  useEffect(() => { if (hydrated) save('wmp:savings',           savings);          }, [savings,          hydrated]);
  useEffect(() => { if (hydrated) save('wmp:mortgages',         mortgages);        }, [mortgages,        hydrated]);
  useEffect(() => { if (hydrated) save('wmp:mortgagePayments',  mortgagePayments); }, [mortgagePayments, hydrated]);
  useEffect(() => { if (hydrated) save('wmp:properties',        properties);       }, [properties,       hydrated]);
  useEffect(() => { if (hydrated) save('wmp:savingsAccounts',   savingsAccounts);  }, [savingsAccounts,  hydrated]);
  useEffect(() => { if (hydrated) save('wmp:savingsHistory',    savingsHistory);   }, [savingsHistory,   hydrated]);
  useEffect(() => { if (hydrated) save('wmp:debts',             debts);            }, [debts,            hydrated]);
  useEffect(() => { if (hydrated) save('wmp:debtTransactions',  debtTransactions); }, [debtTransactions, hydrated]);
  useEffect(() => { if (hydrated) save('wmp:debtHistory',       debtHistory);      }, [debtHistory,      hydrated]);
  useEffect(() => { if (hydrated) save('wmp:pensions',          pensions);         }, [pensions,         hydrated]);
  useEffect(() => { if (hydrated) save('wmp:pensionHistory',    pensionHistory);   }, [pensionHistory,   hydrated]);

  const store: AppStore = {
    hydrated,

    // Budget
    budgets, activeBudgetMonth,
    sources, entries, salaryHistory, pots, expenses, savings,

    upsertBudget: b => setBudgets(prev => {
      const nextBudget = sanitizeBudgetForOneOffExpenses(b, expenses);
      const idx = prev.findIndex(x => x.month === b.month);
      return idx >= 0
        ? prev.map(x => x.month === b.month ? nextBudget : x)
        : [...prev, nextBudget];
    }),
    createBudgetForMonth: month => {
      const nextExpenses = applyPendingOneOffExpensesToBudgetMonth(month, expenses);
      setExpenses(nextExpenses);
      setBudgets(prev => {
        const budget = sanitizeBudgetForOneOffExpenses(createBudget(month, nextExpenses, savings), nextExpenses);
        const idx = prev.findIndex(x => x.month === month);
        return idx >= 0 ? prev.map(x => x.month === month ? budget : x) : [...prev, budget];
      });
    },
    moveBudgetItem: (month, itemId, newPotId) => setBudgets(prev =>
      prev.map(b => b.month !== month ? b : {
        ...b,
        items: b.items.map(i => i.id === itemId ? { ...i, potId: newPotId } : i),
      })
    ),
    setBudgetItemIncomeSource: (month, itemId, incomeSourceId) => setBudgets(prev =>
      prev.map(b => b.month !== month ? b : {
        ...b,
        items: b.items.map(i => i.id === itemId ? { ...i, incomeSourceId: incomeSourceId as typeof i.incomeSourceId } : i),
      })
    ),
    setActiveBudgetMonth: month => setActiveBudgetMonth(month),
    deleteBudget:      month => setBudgets(prev => prev.filter(b => b.month !== month)),
    setBudgetArchived: (month, v) => setBudgets(prev => prev.map(b => b.month !== month ? b : { ...b, archived: v })),
    setBudgetLocked:   (month, v) => setBudgets(prev => prev.map(b => b.month !== month ? b : { ...b, locked: v })),

    upsertSource:  s  => setSources(prev  => upsert(prev, normalizeIncomeSource(s))),
    upsertEntry:   e  => setEntries(prev  => upsert(prev, e)),
    upsertSalaryHistory: h => setSalaryHistory(prev => upsert(prev, normalizeSalaryHistoryEntry(h))),
    removeSalaryHistory: id => setSalaryHistory(prev => prev.filter(entry => entry.id !== id)),
    upsertPot:     p  => setPots(prev     => upsert(prev, normalizePot(p))),
    upsertExpense: e  => {
      const existing = expenses.find(expense => expense.id === e.id) ?? null;
      const openCurrentBudget = budgets.find(b =>
        b.month === currentYearMonth() && !b.archived && !b.locked
      ) ?? null;

      let nextExpense: Expense = {
        ...e,
        oneOffPayment: e.oneOffPayment ?? false,
        oneOffAppliedBudgetMonth: e.oneOffPayment ? e.oneOffAppliedBudgetMonth ?? null : null,
      };

      if (nextExpense.oneOffPayment && !nextExpense.oneOffAppliedBudgetMonth && openCurrentBudget) {
        nextExpense = { ...nextExpense, oneOffAppliedBudgetMonth: openCurrentBudget.month };
      }

      if (!nextExpense.oneOffPayment) {
        nextExpense = { ...nextExpense, oneOffAppliedBudgetMonth: null };
      }

      setExpenses(prev => upsert(prev, nextExpense));

      if (nextExpense.oneOffPayment && nextExpense.oneOffAppliedBudgetMonth) {
        setBudgets(prev => prev.map(budget =>
          budget.month === nextExpense.oneOffAppliedBudgetMonth
            ? syncOneOffExpenseIntoBudget(budget, nextExpense)
            : budget
        ));
      } else if (existing?.oneOffPayment && existing.oneOffAppliedBudgetMonth) {
        const appliedMonth = existing.oneOffAppliedBudgetMonth;
        setBudgets(prev => prev.map(budget =>
          budget.month === appliedMonth
            ? syncOneOffExpenseIntoBudget(budget, {
                ...nextExpense,
                oneOffPayment: true,
                oneOffAppliedBudgetMonth: appliedMonth,
              })
            : budget
        ));
      }
    },
    upsertSaving:  s  => setSavings(prev  => upsert(prev, s)),

    setSourceArchived:  (id, v) => setSources(prev  => setArchived(prev, id, v)),
    removeEntry:        id      => setEntries(prev   => prev.filter(e => e.id !== id)),
    setPotArchived:     (id, v) => setPots(prev      => setArchived(prev, id, v)),
    setExpenseArchived: (id, v) => setExpenses(prev  => setArchived(prev, id, v)),
    setSavingArchived:  (id, v) => setSavings(prev   => setArchived(prev, id, v)),

    // Wealth
    mortgages, mortgagePayments, properties,
    savingsAccounts, savingsHistory,
    debts, debtTransactions, debtHistory,
    pensions, pensionHistory,

    upsertMortgage:        m => setMortgages(prev        => upsert(prev, m)),
    upsertMortgagePayment: p => setMortgagePayments(prev => upsert(prev, p)),
    removeMortgagePayment: id => setMortgagePayments(prev => prev.filter(p => p.id !== id)),
    upsertProperty:        p => setProperties(prev       => upsert(prev, p)),
    upsertSavingsAccount:  a => setSavingsAccounts(prev  => upsert(prev, a)),
    upsertSavingsHistory:  h => setSavingsHistory(prev   => upsert(prev, h)),
    removeSavingsHistory:  id => setSavingsHistory(prev  => prev.filter(h => h.id !== id)),
    upsertDebt:            d => setDebts(prev            => upsert(prev, normalizeDebt(d as Debt & { type?: 'loan' | 'credit-card' }))),
    upsertDebtTransaction: t => {
      const transaction = normalizeDebtTransaction(t);
      setDebtTransactions(prev => upsert(prev, transaction));
      setDebts(prev => prev.map(debt =>
        debt.id === transaction.debtId
          ? { ...debt, currentBalance: applyDebtTransactionToBalance(debt.currentBalance, transaction) }
          : debt
      ));
    },
    removeDebtTransaction: id => {
      const transaction = debtTransactions.find(entry => entry.id === id) ?? null;
      setDebtTransactions(prev => prev.filter(entry => entry.id !== id));
      if (!transaction) return;
      setDebts(prev => prev.map(debt => {
        if (debt.id !== transaction.debtId) return debt;
        return {
          ...debt,
          currentBalance: transaction.type === 'purchase'
            ? Math.max(0, debt.currentBalance - transaction.amount)
            : debt.currentBalance + transaction.amount,
        };
      }));
    },
    upsertDebtHistory:     h => setDebtHistory(prev      => upsert(prev, normalizeDebtHistoryEntry(h))),
    removeDebtHistory:     id => setDebtHistory(prev     => prev.filter(h => h.id !== id)),
    upsertPension:         p => setPensions(prev         => upsert(prev, p)),
    upsertPensionHistory:  h => setPensionHistory(prev   => upsert(prev, h)),
    removePensionHistory:  id => setPensionHistory(prev  => prev.filter(h => h.id !== id)),

    setMortgageArchived:       (id, v) => setMortgages(prev       => setArchived(prev, id, v)),
    setPropertyArchived:       (id, v) => setProperties(prev      => setArchived(prev, id, v)),
    setSavingsAccountArchived: (id, v) => setSavingsAccounts(prev => setArchived(prev, id, v)),
    setDebtArchived:           (id, v) => setDebts(prev           => setArchived(prev, id, v)),
    setPensionArchived:        (id, v) => setPensions(prev        => setArchived(prev, id, v)),
  };

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useStore(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used inside AppProvider');
  return ctx;
}
