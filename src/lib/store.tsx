'use client';

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
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
  refreshBudget,
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
import type { AccessibleUser } from '@/lib/auth/types';

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_VERSION = '0.1.2';
const STORAGE_VERSION_KEY = 'wmp:storageVersion';
const STORAGE_BACKUP_PREFIX = 'wmp:backup:';
const STORAGE_KEYS = [
  'wmp:budgets',
  'wmp:activeBudgetMonth',
  'wmp:sources',
  'wmp:entries',
  'wmp:salaryHistory',
  'wmp:pots',
  'wmp:expenses',
  'wmp:savings',
  'wmp:mortgages',
  'wmp:mortgagePayments',
  'wmp:properties',
  'wmp:savingsAccounts',
  'wmp:savingsHistory',
  'wmp:debts',
  'wmp:debtTransactions',
  'wmp:debtHistory',
  'wmp:pensions',
  'wmp:pensionHistory',
] as const;

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

function ensureStorageUpgradeBackup(): void {
  if (typeof window === 'undefined') return;

  try {
    const previousVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (!previousVersion || previousVersion === STORAGE_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      return;
    }

    const backupKey = `${STORAGE_BACKUP_PREFIX}${previousVersion}`;
    if (!localStorage.getItem(backupKey)) {
      const snapshot = STORAGE_KEYS.reduce<Record<string, string | null>>((acc, key) => {
        acc[key] = localStorage.getItem(key);
        return acc;
      }, {});

      localStorage.setItem(backupKey, JSON.stringify({
        fromVersion: previousVersion,
        toVersion: STORAGE_VERSION,
        createdAt: new Date().toISOString(),
        snapshot,
      }));
    }

    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    // Best-effort only — never block the app from loading user data.
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppStore {
  hydrated: boolean;
  currentUserId: string | null;
  accessibleUsers: AccessibleUser[];

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
  refreshBudgetForMonth:(month: string) => void;
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
  movePot:            (id: string, direction: -1 | 1) => void;
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

function moveByDirection<T extends { id: string }>(prev: T[], id: string, direction: -1 | 1): T[] {
  const index = prev.findIndex(item => item.id === id);
  if (index < 0) return prev;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= prev.length) return prev;

  const next = [...prev];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function normalizeOwnerUserIds(ownerUserIds: string[] | null | undefined, fallbackUserId: string | null): string[] {
  const cleaned = [...new Set((ownerUserIds ?? []).filter(Boolean))];
  if (cleaned.length > 0) return cleaned;
  return fallbackUserId ? [fallbackUserId] : [];
}

function isRecordVisible(record: { ownerUserIds: string[] }, accessibleUserIds: string[]): boolean {
  if (accessibleUserIds.length === 0) return true;
  return record.ownerUserIds.some(userId => accessibleUserIds.includes(userId));
}

function filterOwnedRecords<T extends { ownerUserIds: string[] }>(records: T[], accessibleUserIds: string[]): T[] {
  return records.filter(record => isRecordVisible(record, accessibleUserIds));
}

function normalizeIncomeSource(source: IncomeSource, fallbackUserId: string | null): IncomeSource {
  return {
    ...source,
    startingAnnualSalary: source.startingAnnualSalary ?? null,
    ownerUserIds: normalizeOwnerUserIds(source.ownerUserIds, fallbackUserId),
  };
}

function normalizeIncomeSources(sources: IncomeSource[], fallbackUserId: string | null): IncomeSource[] {
  return sources.map(source => normalizeIncomeSource(source, fallbackUserId));
}

function normalizePot(pot: Pot, fallbackUserId: string | null): Pot {
  return {
    id: pot.id,
    name: pot.name,
    isBusiness: pot.isBusiness ?? false,
    ownerUserIds: normalizeOwnerUserIds(pot.ownerUserIds, fallbackUserId),
    archived: pot.archived,
  };
}

function normalizePots(pots: Pot[], fallbackUserId: string | null): Pot[] {
  return pots.map(pot => normalizePot(pot, fallbackUserId));
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

function normalizeExpense(expense: Expense, fallbackUserId: string | null): Expense {
  return {
    ...expense,
    ownerUserIds: normalizeOwnerUserIds(expense.ownerUserIds, fallbackUserId),
    oneOffPayment: expense.oneOffPayment ?? false,
    oneOffAppliedBudgetMonth: expense.oneOffAppliedBudgetMonth ?? null,
  };
}

function normalizeExpenseWithSource(
  expense: Expense & { incomeSourceId?: string | null },
  pots: Array<Pot & { incomeSourceId?: string }>,
  fallbackUserId: string | null,
): Expense {
  const linkedPot = pots.find(pot => pot.id === expense.potId);
  return {
    ...normalizeExpense(expense, fallbackUserId),
    incomeSourceId: (expense.incomeSourceId ?? linkedPot?.incomeSourceId ?? '') as Expense['incomeSourceId'],
  };
}

function normalizeSavingWithSource(
  saving: Saving & { incomeSourceId?: string | null },
  pots: Array<Pot & { incomeSourceId?: string }>,
  fallbackUserId: string | null,
): Saving {
  const linkedPot = pots.find(pot => pot.id === saving.potId);
  return {
    ...saving,
    incomeSourceId: (saving.incomeSourceId ?? linkedPot?.incomeSourceId ?? '') as Saving['incomeSourceId'],
    ownerUserIds: normalizeOwnerUserIds(saving.ownerUserIds, fallbackUserId),
  };
}

function normalizeBudgets(
  budgets: LocalBudget[],
  expenses: Expense[],
  savings: Saving[],
  fallbackUserId: string | null,
): LocalBudget[] {
  const expenseOwners = new Map(expenses.map(expense => [expense.id as string, expense.ownerUserIds]));
  const savingOwners = new Map(savings.map(saving => [saving.id as string, saving.ownerUserIds]));

  return budgets.map(budget => sanitizeBudgetForOneOffExpenses({
    ...budget,
    items: budget.items.map(item => {
      const sourceOwners = item.sourceType === 'expense'
        ? expenseOwners.get(item.sourceId)
        : savingOwners.get(item.sourceId);
      const ownerUserIds = normalizeOwnerUserIds(item.ownerUserIds ?? sourceOwners, fallbackUserId);
      return {
        ...item,
        ownerUserIds,
        defaultOwnerUserIds: normalizeOwnerUserIds(item.defaultOwnerUserIds ?? sourceOwners ?? ownerUserIds, fallbackUserId),
      };
    }),
  }, expenses));
}

function normalizeMortgage(mortgage: Mortgage, fallbackUserId: string | null): Mortgage {
  return {
    ...mortgage,
    ownerUserIds: normalizeOwnerUserIds(mortgage.ownerUserIds, fallbackUserId),
  };
}

function normalizeProperty(property: Property, fallbackUserId: string | null): Property {
  return {
    ...property,
    ownerUserIds: normalizeOwnerUserIds(property.ownerUserIds, fallbackUserId),
  };
}

function normalizeSavingsAccount(account: SavingsAccount, fallbackUserId: string | null): SavingsAccount {
  return {
    ...account,
    ownerUserIds: normalizeOwnerUserIds(account.ownerUserIds, fallbackUserId),
  };
}

function normalizeSavingsAccounts(accounts: SavingsAccount[], fallbackUserId: string | null): SavingsAccount[] {
  return accounts.map(account => normalizeSavingsAccount(account, fallbackUserId));
}

function normalizeDebt(debt: Debt & { type?: 'loan' | 'credit-card' }, fallbackUserId: string | null): Debt {
  return {
    ...debt,
    debtType: debt.debtType ?? debt.type ?? 'loan',
    borrowedAmount: debt.borrowedAmount ?? null,
    termMonths: debt.termMonths ?? null,
    startDate: debt.startDate ?? null,
    ownerUserIds: normalizeOwnerUserIds(debt.ownerUserIds, fallbackUserId),
  };
}

function normalizeDebts(debts: Debt[], fallbackUserId: string | null): Debt[] {
  return debts.map(debt => normalizeDebt(debt, fallbackUserId));
}

function normalizePension(pension: Pension, fallbackUserId: string | null): Pension {
  return {
    ...pension,
    ownerUserIds: normalizeOwnerUserIds(pension.ownerUserIds, fallbackUserId),
  };
}

function normalizePensions(pensions: Pension[], fallbackUserId: string | null): Pension[] {
  return pensions.map(pension => normalizePension(pension, fallbackUserId));
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

export function AppProvider({
  children,
  currentUserId = null,
  accessibleUsers = [],
}: {
  children: ReactNode;
  currentUserId?: string | null;
  accessibleUsers?: AccessibleUser[];
}) {
  // Initialize from MOCK data so server and client render identical HTML (no hydration mismatch).
  // localStorage is loaded in the effect below, after hydration.
  const [hydrated,          setHydrated]          = useState(false);
  const [budgets,           setBudgets]           = useState<LocalBudget[]>(MOCK_BUDGETS);
  const [activeBudgetMonth, setActiveBudgetMonth] = useState(currentYearMonth());
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

  const accessibleUserIds = useMemo(
    () => accessibleUsers.map(user => user.id),
    [accessibleUsers],
  );

  // Runs once on the client after hydration — safe to access localStorage here.
  useEffect(() => {
    ensureStorageUpgradeBackup();

    const loadedBudgets = load('wmp:budgets', MOCK_BUDGETS);
    const loadedSources = normalizeIncomeSources(load('wmp:sources', MOCK_INCOME_SOURCES), currentUserId);
    const loadedEntries = load('wmp:entries', MOCK_INCOME_ENTRIES);
    const loadedSalaryHistory = normalizeSalaryHistory(load('wmp:salaryHistory', MOCK_SALARY_HISTORY));
    const loadedPots = load('wmp:pots', MOCK_POTS) as Array<Pot & { incomeSourceId?: string }>;
    const loadedExpenses = load('wmp:expenses', MOCK_EXPENSES) as Array<Expense & { incomeSourceId?: string | null }>;
    const loadedSavings = load('wmp:savings', MOCK_SAVINGS) as Array<Saving & { incomeSourceId?: string | null }>;
    const normalizedPots = normalizePots(loadedPots, currentUserId);
    const normalizedExpenses = loadedExpenses.map(expense => normalizeExpenseWithSource(expense, loadedPots, currentUserId));
    const normalizedSavings = loadedSavings.map(saving => normalizeSavingWithSource(saving, loadedPots, currentUserId));
    const migratedIncomeData = migrateIncomeSourceProvider(
      loadedSources,
      loadedEntries,
      loadedSalaryHistory,
      normalizedExpenses,
      normalizedSavings,
      loadedBudgets,
    );

    setBudgets          (normalizeBudgets(migratedIncomeData.budgets, migratedIncomeData.expenses, migratedIncomeData.savings, currentUserId));
    setActiveBudgetMonth(load('wmp:activeBudgetMonth', currentYearMonth()));
    setSources          (migratedIncomeData.sources);
    setEntries          (migratedIncomeData.entries);
    setSalaryHistory    (migratedIncomeData.salaryHistory);
    setPots             (normalizedPots);
    setExpenses         (migratedIncomeData.expenses);
    setSavings          (migratedIncomeData.savings);
    setMortgages        ((load('wmp:mortgages',         MOCK_MORTGAGES) as Mortgage[]).map(mortgage => normalizeMortgage(mortgage, currentUserId)));
    setMortgagePayments (load('wmp:mortgagePayments',  MOCK_MORTGAGE_PAYMENTS));
    setProperties       ((load('wmp:properties',        MOCK_PROPERTIES) as Property[]).map(property => normalizeProperty(property, currentUserId)));
    setSavingsAccounts  (normalizeSavingsAccounts(load('wmp:savingsAccounts', MOCK_SAVINGS_ACCOUNTS), currentUserId));
    setSavingsHistory   (load('wmp:savingsHistory',    MOCK_SAVINGS_HISTORY));
    const loadedDebts = normalizeDebts(load('wmp:debts', MOCK_DEBTS), currentUserId);
    const loadedDebtTransactions = normalizeDebtTransactions(load('wmp:debtTransactions', MOCK_DEBT_TRANSACTIONS));
    setDebts            (loadedDebts);
    setDebtTransactions (loadedDebtTransactions);
    setDebtHistory      (normalizeDebtHistory(load('wmp:debtHistory', MOCK_DEBT_HISTORY)));
    setPensions         (normalizePensions(load('wmp:pensions', MOCK_PENSIONS), currentUserId));
    setPensionHistory   (load('wmp:pensionHistory',    MOCK_PENSION_HISTORY));
    setHydrated(true);
  }, [currentUserId]);

  const visibleSources = filterOwnedRecords(sources, accessibleUserIds);
  const visibleSourceIds = new Set(visibleSources.map(source => source.id as string));
  const visibleEntries = entries.filter(entry => visibleSourceIds.has(entry.incomeSourceId as string));
  const visibleSalaryHistory = salaryHistory.filter(entry => visibleSourceIds.has(entry.incomeSourceId as string));
  const visiblePots = filterOwnedRecords(pots, accessibleUserIds);
  const visiblePotIds = new Set(visiblePots.map(pot => pot.id as string));
  const visibleExpenses = filterOwnedRecords(expenses, accessibleUserIds).filter(expense => visiblePotIds.has(expense.potId as string));
  const visibleSavings = filterOwnedRecords(savings, accessibleUserIds).filter(saving => visiblePotIds.has(saving.potId as string));
  const visibleMortgages = filterOwnedRecords(mortgages, accessibleUserIds);
  const visibleMortgageIds = new Set(visibleMortgages.map(mortgage => mortgage.id as string));
  const visibleMortgagePayments = mortgagePayments.filter(payment => visibleMortgageIds.has(payment.mortgageId as string));
  const visibleSavingsAccounts = filterOwnedRecords(savingsAccounts, accessibleUserIds);
  const visibleSavingsAccountIds = new Set(visibleSavingsAccounts.map(account => account.id as string));
  const visibleSavingsHistory = savingsHistory.filter(entry => visibleSavingsAccountIds.has(entry.savingsAccountId as string));
  const visibleProperties = filterOwnedRecords(properties, accessibleUserIds).filter(property => !property.mortgageId || visibleMortgageIds.has(property.mortgageId as string));
  const visibleDebts = filterOwnedRecords(debts, accessibleUserIds);
  const visibleDebtIds = new Set(visibleDebts.map(debt => debt.id as string));
  const visibleDebtTransactions = debtTransactions.filter(entry => visibleDebtIds.has(entry.debtId as string));
  const visibleDebtHistory = debtHistory.filter(entry => visibleDebtIds.has(entry.debtId as string));
  const visiblePensions = filterOwnedRecords(pensions, accessibleUserIds);
  const visiblePensionIds = new Set(visiblePensions.map(pension => pension.id as string));
  const visiblePensionHistory = pensionHistory.filter(entry => visiblePensionIds.has(entry.pensionId as string));
  const visibleBudgets = budgets.map(budget => ({
    ...budget,
    items: budget.items.filter(item =>
      isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(item.ownerUserIds, currentUserId) }, accessibleUserIds)
      && visiblePotIds.has(item.potId as string)
    ),
  }));

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
    currentUserId,
    accessibleUsers,

    // Budget
    budgets: visibleBudgets, activeBudgetMonth,
    sources: visibleSources,
    entries: visibleEntries,
    salaryHistory: visibleSalaryHistory,
    pots: visiblePots,
    expenses: visibleExpenses,
    savings: visibleSavings,

    upsertBudget: b => setBudgets(prev => {
      const nextBudget = sanitizeBudgetForOneOffExpenses(b, visibleExpenses);
      const idx = prev.findIndex(x => x.month === b.month);
      return idx >= 0
        ? prev.map(x => x.month === b.month ? nextBudget : x)
        : [...prev, nextBudget];
    }),
    createBudgetForMonth: month => {
      const visibleExpenseIds = new Set(visibleExpenses.map(expense => expense.id as string));
      const nextExpenses = expenses.map(expense =>
        visibleExpenseIds.has(expense.id as string)
          ? applyPendingOneOffExpensesToBudgetMonth(month, [expense])[0]
          : expense
      );
      const visibleNextExpenses = nextExpenses.filter(expense =>
        isRecordVisible(expense, accessibleUserIds) && visiblePotIds.has(expense.potId as string)
      );
      setExpenses(nextExpenses);
      setBudgets(prev => {
        const budget = sanitizeBudgetForOneOffExpenses(
          createBudget(month, visibleNextExpenses, visibleSavings),
          visibleNextExpenses,
        );
        const idx = prev.findIndex(x => x.month === month);
        return idx >= 0 ? prev.map(x => x.month === month ? budget : x) : [...prev, budget];
      });
    },
    refreshBudgetForMonth: month => {
      const visibleExpenseIds = new Set(visibleExpenses.map(expense => expense.id as string));
      const nextExpenses = expenses.map(expense =>
        visibleExpenseIds.has(expense.id as string)
          ? applyPendingOneOffExpensesToBudgetMonth(month, [expense])[0]
          : expense
      );
      const visibleNextExpenses = nextExpenses.filter(expense =>
        isRecordVisible(expense, accessibleUserIds) && visiblePotIds.has(expense.potId as string)
      );

      setExpenses(nextExpenses);
      setBudgets(prev => prev.map(budget => {
        if (budget.month !== month) return budget;
        return sanitizeBudgetForOneOffExpenses(
          refreshBudget(budget, visibleNextExpenses, visibleSavings),
          visibleNextExpenses,
        );
      }));
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

    upsertSource:  s  => setSources(prev  => upsert(prev, normalizeIncomeSource(s, currentUserId))),
    upsertEntry:   e  => setEntries(prev  => upsert(prev, e)),
    upsertSalaryHistory: h => setSalaryHistory(prev => upsert(prev, normalizeSalaryHistoryEntry(h))),
    removeSalaryHistory: id => setSalaryHistory(prev => prev.filter(entry => entry.id !== id)),
    upsertPot:     p  => setPots(prev     => upsert(prev, normalizePot(p, currentUserId))),
    upsertExpense: e  => {
      const existing = expenses.find(expense => expense.id === e.id) ?? null;
      const openCurrentBudget = budgets.find(b =>
        b.month === currentYearMonth() && !b.archived && !b.locked
      ) ?? null;

      let nextExpense: Expense = {
        ...e,
        ownerUserIds: normalizeOwnerUserIds(e.ownerUserIds, currentUserId),
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
    upsertSaving:  s  => setSavings(prev  => upsert(prev, {
      ...s,
      ownerUserIds: normalizeOwnerUserIds(s.ownerUserIds, currentUserId),
    })),

    setSourceArchived:  (id, v) => setSources(prev  => setArchived(prev, id, v)),
    removeEntry:        id      => setEntries(prev   => prev.filter(e => e.id !== id)),
    movePot:            (id, direction) => setPots(prev => moveByDirection(prev, id, direction)),
    setPotArchived:     (id, v) => setPots(prev      => setArchived(prev, id, v)),
    setExpenseArchived: (id, v) => setExpenses(prev  => setArchived(prev, id, v)),
    setSavingArchived:  (id, v) => setSavings(prev   => setArchived(prev, id, v)),

    // Wealth
    mortgages: visibleMortgages, mortgagePayments: visibleMortgagePayments, properties: visibleProperties,
    savingsAccounts: visibleSavingsAccounts, savingsHistory: visibleSavingsHistory,
    debts: visibleDebts, debtTransactions: visibleDebtTransactions, debtHistory: visibleDebtHistory,
    pensions: visiblePensions, pensionHistory: visiblePensionHistory,

    upsertMortgage:        m => setMortgages(prev        => upsert(prev, normalizeMortgage(m, currentUserId))),
    upsertMortgagePayment: p => setMortgagePayments(prev => upsert(prev, p)),
    removeMortgagePayment: id => setMortgagePayments(prev => prev.filter(p => p.id !== id)),
    upsertProperty:        p => setProperties(prev       => upsert(prev, normalizeProperty(p, currentUserId))),
    upsertSavingsAccount:  a => setSavingsAccounts(prev  => upsert(prev, normalizeSavingsAccount(a, currentUserId))),
    upsertSavingsHistory:  h => setSavingsHistory(prev   => upsert(prev, h)),
    removeSavingsHistory:  id => setSavingsHistory(prev  => prev.filter(h => h.id !== id)),
    upsertDebt:            d => setDebts(prev => upsert(prev, normalizeDebt(d as Debt & { type?: 'loan' | 'credit-card' }, currentUserId))),
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
    upsertPension:         p => setPensions(prev         => upsert(prev, normalizePension(p, currentUserId))),
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
