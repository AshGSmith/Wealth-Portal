'use client';

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import {
  applyPendingOneOffExpensesToBudgetMonth,
  createBudget,
  refreshBudget,
  resolveExpenseForMonth,
  sanitizeBudgetForOneOffExpenses,
  type LocalBudget,
} from '@/lib/budgetLogic';
import { buildLockedBudgetSnapshot, calcBudget } from '@/lib/budgetCalc';
import type {
  IncomeSource, IncomeEntry, Pot, Expense, Saving, SalaryHistory, SavingAmountHistory,
  Mortgage, MortgagePayment, Property,
  SavingsAccount, SavingsHistory,
  Debt, DebtHistory, DebtTransaction,
  Pension, PensionHistory,
  PotId,
  IncomeSourceId,
} from '@/lib/types';
import type { AccessibleUser } from '@/lib/auth/types';
import type { PersistedAppData } from '@/lib/data/server';

// ─── Legacy localStorage helpers ──────────────────────────────────────────────

const STORAGE_VERSION = '0.1.2';
const STORAGE_VERSION_KEY = 'wmp:storageVersion';
const STORAGE_BACKUP_PREFIX = 'wmp:backup:';
const ACTIVE_BUDGET_MONTH_KEY = 'wmp:activeBudgetMonth';
const LEGACY_MIGRATION_DISMISSED_PREFIX = 'wmp:legacyMigrationDismissed:';
const LEGACY_MIGRATION_IMPORTED_PREFIX = 'wmp:legacyMigrationImported:';
const STORAGE_KEYS = [
  'wmp:budgets',
  'wmp:sources',
  'wmp:entries',
  'wmp:salaryHistory',
  'wmp:pots',
  'wmp:expenses',
  'wmp:savings',
  'wmp:savingAmountHistory',
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

function saveLocalValue<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota exceeded or SSR */ }
}

function removeLocalValue(key: string): void {
  try { localStorage.removeItem(key); } catch { /* noop */ }
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

function emptyPersistedAppData(): PersistedAppData {
  return {
    budgets: [],
    sources: [],
    entries: [],
    salaryHistory: [],
    pots: [],
    expenses: [],
    savings: [],
    savingAmountHistory: [],
    mortgages: [],
    mortgagePayments: [],
    properties: [],
    savingsAccounts: [],
    savingsHistory: [],
    debts: [],
    debtTransactions: [],
    debtHistory: [],
    pensions: [],
    pensionHistory: [],
  };
}

function isPersistedAppDataEmpty(data: PersistedAppData): boolean {
  return Object.values(data).every(value => Array.isArray(value) && value.length === 0);
}

function countPersistedRecords(data: PersistedAppData): number {
  return Object.values(data).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppStore {
  hydrated: boolean;
  currentUserId: string | null;
  accessibleUsers: AccessibleUser[];
  legacyMigrationAvailable: boolean;
  legacyMigrationRequiresConfirmation: boolean;
  legacyMigrationInProgress: boolean;
  legacyMigrationRecordCount: number;
  importLegacyLocalData: () => Promise<void>;
  dismissLegacyMigration: () => void;

  // Budget
  budgets:           LocalBudget[];
  activeBudgetMonth: string;
  sources:           IncomeSource[];
  entries:           IncomeEntry[];
  salaryHistory:     SalaryHistory[];
  pots:              Pot[];
  expenses:          Expense[];
  savings:           Saving[];
  savingAmountHistory: SavingAmountHistory[];

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
  upsertSavingAmountHistory: (h: SavingAmountHistory) => void;
  removeSavingAmountHistory: (id: string) => void;

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
  sources: IncomeSource[],
  pots: Pot[],
  expenses: Expense[],
  savings: Saving[],
  fallbackUserId: string | null,
): LocalBudget[] {
  const expenseOwners = new Map(expenses.map(expense => [expense.id as string, expense.ownerUserIds]));
  const savingOwners = new Map(savings.map(saving => [saving.id as string, saving.ownerUserIds]));
  const sourceNames = new Map(sources.map(source => [source.id as string, source.provider]));
  const potNames = new Map(pots.map(pot => [pot.id as string, pot.name]));

  return budgets.map(budget => {
    const normalizedBudget = {
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
          incomeSourceName: item.incomeSourceName || sourceNames.get(item.incomeSourceId as string) || '',
          potName: item.potName || potNames.get(item.potId as string) || '',
        };
      }),
    };

    return normalizedBudget.locked
      ? normalizedBudget
      : sanitizeBudgetForOneOffExpenses(normalizedBudget, expenses);
  });
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
  if (budget.locked) {
    return budget;
  }

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

function decorateBudgetItemsWithLabels(
  budget: LocalBudget,
  pots: Pot[],
  sources: IncomeSource[],
): LocalBudget {
  const potNames = new Map(pots.map(pot => [pot.id as string, pot.name]));
  const sourceNames = new Map(sources.map(source => [source.id as string, source.provider]));

  return {
    ...budget,
    items: budget.items.map(item => ({
      ...item,
      potName: potNames.get(item.potId as string) ?? item.potName,
      incomeSourceName: sourceNames.get(item.incomeSourceId as string) ?? item.incomeSourceName,
    })),
  };
}

function normalizePersistedDataSnapshot(
  snapshot: PersistedAppData,
  fallbackUserId: string | null,
): PersistedAppData {
  const loadedPots = snapshot.pots as Array<Pot & { incomeSourceId?: string }>;
  const loadedExpenses = snapshot.expenses as Array<Expense & { incomeSourceId?: string | null }>;
  const loadedSavings = snapshot.savings as Array<Saving & { incomeSourceId?: string | null }>;
  const normalizedPots = normalizePots(loadedPots, fallbackUserId);
  const normalizedExpenses = loadedExpenses.map(expense => normalizeExpenseWithSource(expense, loadedPots, fallbackUserId));
  const normalizedSavings = loadedSavings.map(saving => normalizeSavingWithSource(saving, loadedPots, fallbackUserId));
  const migratedIncomeData = migrateIncomeSourceProvider(
    normalizeIncomeSources(snapshot.sources, fallbackUserId),
    snapshot.entries,
    normalizeSalaryHistory(snapshot.salaryHistory),
    normalizedExpenses,
    normalizedSavings,
    snapshot.budgets,
  );

  return {
    budgets: normalizeBudgets(migratedIncomeData.budgets, migratedIncomeData.sources, normalizedPots, migratedIncomeData.expenses, migratedIncomeData.savings, fallbackUserId),
    sources: migratedIncomeData.sources,
    entries: migratedIncomeData.entries,
    salaryHistory: migratedIncomeData.salaryHistory,
    pots: normalizedPots,
    expenses: migratedIncomeData.expenses,
    savings: migratedIncomeData.savings,
    savingAmountHistory: snapshot.savingAmountHistory,
    mortgages: snapshot.mortgages.map(mortgage => normalizeMortgage(mortgage, fallbackUserId)),
    mortgagePayments: snapshot.mortgagePayments,
    properties: snapshot.properties.map(property => normalizeProperty(property, fallbackUserId)),
    savingsAccounts: normalizeSavingsAccounts(snapshot.savingsAccounts, fallbackUserId),
    savingsHistory: snapshot.savingsHistory,
    debts: normalizeDebts(snapshot.debts, fallbackUserId),
    debtTransactions: normalizeDebtTransactions(snapshot.debtTransactions),
    debtHistory: normalizeDebtHistory(snapshot.debtHistory),
    pensions: normalizePensions(snapshot.pensions, fallbackUserId),
    pensionHistory: snapshot.pensionHistory,
  };
}

function loadLegacyLocalAppData(fallbackUserId: string | null): PersistedAppData {
  const emptyData = emptyPersistedAppData();
  return normalizePersistedDataSnapshot({
    budgets: load('wmp:budgets', emptyData.budgets),
    sources: load('wmp:sources', emptyData.sources),
    entries: load('wmp:entries', emptyData.entries),
    salaryHistory: load('wmp:salaryHistory', emptyData.salaryHistory),
    pots: load('wmp:pots', emptyData.pots),
    expenses: load('wmp:expenses', emptyData.expenses),
    savings: load('wmp:savings', emptyData.savings),
    savingAmountHistory: load('wmp:savingAmountHistory', emptyData.savingAmountHistory),
    mortgages: load('wmp:mortgages', emptyData.mortgages),
    mortgagePayments: load('wmp:mortgagePayments', emptyData.mortgagePayments),
    properties: load('wmp:properties', emptyData.properties),
    savingsAccounts: load('wmp:savingsAccounts', emptyData.savingsAccounts),
    savingsHistory: load('wmp:savingsHistory', emptyData.savingsHistory),
    debts: load('wmp:debts', emptyData.debts),
    debtTransactions: load('wmp:debtTransactions', emptyData.debtTransactions),
    debtHistory: load('wmp:debtHistory', emptyData.debtHistory),
    pensions: load('wmp:pensions', emptyData.pensions),
    pensionHistory: load('wmp:pensionHistory', emptyData.pensionHistory),
  }, fallbackUserId);
}

async function fetchPersistedAppData(): Promise<PersistedAppData> {
  const response = await fetch('/api/app-data', {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load app data (${response.status})`);
  }

  return response.json() as Promise<PersistedAppData>;
}

async function savePersistedAppData(snapshot: PersistedAppData): Promise<void> {
  const response = await fetch('/api/app-data', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`Failed to save app data (${response.status})`);
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppStore | null>(null);

function applySnapshotToState(
  snapshot: PersistedAppData,
  setters: {
    setBudgets: (value: LocalBudget[]) => void;
    setSources: (value: IncomeSource[]) => void;
    setEntries: (value: IncomeEntry[]) => void;
    setSalaryHistory: (value: SalaryHistory[]) => void;
    setPots: (value: Pot[]) => void;
    setExpenses: (value: Expense[]) => void;
    setSavings: (value: Saving[]) => void;
    setSavingAmountHistory: (value: SavingAmountHistory[]) => void;
    setMortgages: (value: Mortgage[]) => void;
    setMortgagePayments: (value: MortgagePayment[]) => void;
    setProperties: (value: Property[]) => void;
    setSavingsAccounts: (value: SavingsAccount[]) => void;
    setSavingsHistory: (value: SavingsHistory[]) => void;
    setDebts: (value: Debt[]) => void;
    setDebtTransactions: (value: DebtTransaction[]) => void;
    setDebtHistory: (value: DebtHistory[]) => void;
    setPensions: (value: Pension[]) => void;
    setPensionHistory: (value: PensionHistory[]) => void;
  },
): void {
  setters.setBudgets(snapshot.budgets);
  setters.setSources(snapshot.sources);
  setters.setEntries(snapshot.entries);
  setters.setSalaryHistory(snapshot.salaryHistory);
  setters.setPots(snapshot.pots);
  setters.setExpenses(snapshot.expenses);
  setters.setSavings(snapshot.savings);
  setters.setSavingAmountHistory(snapshot.savingAmountHistory);
  setters.setMortgages(snapshot.mortgages);
  setters.setMortgagePayments(snapshot.mortgagePayments);
  setters.setProperties(snapshot.properties);
  setters.setSavingsAccounts(snapshot.savingsAccounts);
  setters.setSavingsHistory(snapshot.savingsHistory);
  setters.setDebts(snapshot.debts);
  setters.setDebtTransactions(snapshot.debtTransactions);
  setters.setDebtHistory(snapshot.debtHistory);
  setters.setPensions(snapshot.pensions);
  setters.setPensionHistory(snapshot.pensionHistory);
}

export function AppProvider({
  children,
  currentUserId = null,
  accessibleUsers = [],
}: {
  children: ReactNode;
  currentUserId?: string | null;
  accessibleUsers?: AccessibleUser[];
}) {
  const initialData = useMemo(() => emptyPersistedAppData(), []);

  const [hydrated,          setHydrated]          = useState(false);
  const [legacyMigrationData, setLegacyMigrationData] = useState<PersistedAppData | null>(null);
  const [legacyMigrationRequiresConfirmation, setLegacyMigrationRequiresConfirmation] = useState(false);
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(false);
  const [legacyMigrationInProgress, setLegacyMigrationInProgress] = useState(false);
  const [budgets,           setBudgets]           = useState<LocalBudget[]>(initialData.budgets);
  const [activeBudgetMonth, setActiveBudgetMonth] = useState(currentYearMonth());
  const [sources,           setSources]           = useState<IncomeSource[]>(initialData.sources);
  const [entries,           setEntries]           = useState<IncomeEntry[]> (initialData.entries);
  const [salaryHistory,     setSalaryHistory]     = useState<SalaryHistory[]>(initialData.salaryHistory);
  const [pots,              setPots]              = useState<Pot[]>         (initialData.pots);
  const [expenses,          setExpenses]          = useState<Expense[]>     (initialData.expenses);
  const [savings,           setSavings]           = useState<Saving[]>      (initialData.savings);
  const [savingAmountHistory, setSavingAmountHistory] = useState<SavingAmountHistory[]>(initialData.savingAmountHistory);

  // Wealth state
  const [mortgages,        setMortgages]        = useState<Mortgage[]>       (initialData.mortgages);
  const [mortgagePayments, setMortgagePayments] = useState<MortgagePayment[]>(initialData.mortgagePayments);
  const [properties,       setProperties]       = useState<Property[]>       (initialData.properties);
  const [savingsAccounts,  setSavingsAccounts]  = useState<SavingsAccount[]> (initialData.savingsAccounts);
  const [savingsHistory,   setSavingsHistory]   = useState<SavingsHistory[]> (initialData.savingsHistory);
  const [debts,            setDebts]            = useState<Debt[]>           (initialData.debts);
  const [debtTransactions, setDebtTransactions] = useState<DebtTransaction[]>(initialData.debtTransactions);
  const [debtHistory,      setDebtHistory]      = useState<DebtHistory[]>    (initialData.debtHistory);
  const [pensions,         setPensions]         = useState<Pension[]>        (initialData.pensions);
  const [pensionHistory,   setPensionHistory]   = useState<PensionHistory[]> (initialData.pensionHistory);

  const accessibleUserIds = useMemo(
    () => accessibleUsers.map(user => user.id),
    [accessibleUsers],
  );
  const legacyMigrationDismissedKey = currentUserId ? `${LEGACY_MIGRATION_DISMISSED_PREFIX}${currentUserId}` : null;
  const legacyMigrationImportedKey = currentUserId ? `${LEGACY_MIGRATION_IMPORTED_PREFIX}${currentUserId}` : null;

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromAccount() {
      setActiveBudgetMonth(load(ACTIVE_BUDGET_MONTH_KEY, currentYearMonth()));

      if (!currentUserId) {
        if (!cancelled) {
          setLegacyMigrationData(null);
          setLegacyMigrationRequiresConfirmation(false);
          setLegacyMigrationDismissed(false);
          applySnapshotToState(emptyPersistedAppData(), {
            setBudgets,
            setSources,
            setEntries,
            setSalaryHistory,
            setPots,
            setExpenses,
            setSavings,
            setSavingAmountHistory,
            setMortgages,
            setMortgagePayments,
            setProperties,
            setSavingsAccounts,
            setSavingsHistory,
            setDebts,
            setDebtTransactions,
            setDebtHistory,
            setPensions,
            setPensionHistory,
          });
          setHydrated(true);
        }
        return;
      }

      ensureStorageUpgradeBackup();

      try {
        const serverData = normalizePersistedDataSnapshot(await fetchPersistedAppData(), currentUserId);
        const legacyData = loadLegacyLocalAppData(currentUserId);
        const hasLegacyData = !isPersistedAppDataEmpty(legacyData);
        const backendHasData = !isPersistedAppDataEmpty(serverData);
        const dismissed = legacyMigrationDismissedKey ? load(legacyMigrationDismissedKey, false) : false;
        const imported = legacyMigrationImportedKey ? load(legacyMigrationImportedKey, false) : false;

        if (cancelled) return;

        setLegacyMigrationData(hasLegacyData && !dismissed && !imported ? legacyData : null);
        setLegacyMigrationRequiresConfirmation(hasLegacyData && backendHasData);
        setLegacyMigrationDismissed(dismissed || imported);

        applySnapshotToState(serverData, {
          setBudgets,
          setSources,
          setEntries,
          setSalaryHistory,
          setPots,
          setExpenses,
          setSavings,
          setSavingAmountHistory,
          setMortgages,
          setMortgagePayments,
          setProperties,
          setSavingsAccounts,
          setSavingsHistory,
          setDebts,
          setDebtTransactions,
          setDebtHistory,
          setPensions,
          setPensionHistory,
        });
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to hydrate authenticated app data from the backend.', error);
        const legacyData = loadLegacyLocalAppData(currentUserId);
        const hasLegacyData = !isPersistedAppDataEmpty(legacyData);
        const dismissed = legacyMigrationDismissedKey ? load(legacyMigrationDismissedKey, false) : false;
        const imported = legacyMigrationImportedKey ? load(legacyMigrationImportedKey, false) : false;
        setLegacyMigrationData(hasLegacyData && !dismissed && !imported ? legacyData : null);
        setLegacyMigrationRequiresConfirmation(false);
        setLegacyMigrationDismissed(dismissed || imported);
        applySnapshotToState(emptyPersistedAppData(), {
          setBudgets,
          setSources,
          setEntries,
          setSalaryHistory,
          setPots,
          setExpenses,
          setSavings,
          setSavingAmountHistory,
          setMortgages,
          setMortgagePayments,
          setProperties,
          setSavingsAccounts,
          setSavingsHistory,
          setDebts,
          setDebtTransactions,
          setDebtHistory,
          setPensions,
          setPensionHistory,
        });
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void hydrateFromAccount();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, legacyMigrationDismissedKey, legacyMigrationImportedKey]);

  const visibleSources = filterOwnedRecords(sources, accessibleUserIds);
  const visibleSourceIds = new Set(visibleSources.map(source => source.id as string));
  const visibleEntries = entries.filter(entry => visibleSourceIds.has(entry.incomeSourceId as string));
  const visibleSalaryHistory = salaryHistory.filter(entry => visibleSourceIds.has(entry.incomeSourceId as string));
  const visiblePots = filterOwnedRecords(pots, accessibleUserIds);
  const visiblePotIds = new Set(visiblePots.map(pot => pot.id as string));
  const visibleExpenses = filterOwnedRecords(expenses, accessibleUserIds).filter(expense => visiblePotIds.has(expense.potId as string));
  const visibleSavings = filterOwnedRecords(savings, accessibleUserIds).filter(saving => visiblePotIds.has(saving.potId as string));
  const visibleSavingIds = new Set(visibleSavings.map(saving => saving.id as string));
  const visibleSavingAmountHistory = savingAmountHistory.filter(entry => visibleSavingIds.has(entry.savingId as string));
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
  const visibleBudgets = budgets
    .map(budget => ({
      ...budget,
      items: budget.items.filter(item =>
        isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(item.ownerUserIds, currentUserId) }, accessibleUserIds)
        && (budget.locked || visiblePotIds.has(item.potId as string))
      ),
    }))
    .filter(budget =>
      budget.items.length > 0
      || isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(budget.ownerUserIds, currentUserId) }, accessibleUserIds)
    );

  useEffect(() => {
    if (!hydrated) return;
    saveLocalValue(ACTIVE_BUDGET_MONTH_KEY, activeBudgetMonth);
  }, [activeBudgetMonth, hydrated]);

  useEffect(() => {
    if (!hydrated || !currentUserId) return;

    const timeoutId = window.setTimeout(() => {
      void savePersistedAppData({
        budgets,
        sources,
        entries,
        salaryHistory,
        pots,
        expenses,
        savings,
        savingAmountHistory,
        mortgages,
        mortgagePayments,
        properties,
        savingsAccounts,
        savingsHistory,
        debts,
        debtTransactions,
        debtHistory,
        pensions,
        pensionHistory,
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    budgets,
    currentUserId,
    debtHistory,
    debtTransactions,
    debts,
    entries,
    expenses,
    hydrated,
    mortgagePayments,
    mortgages,
    pensionHistory,
    pensions,
    pots,
    properties,
    salaryHistory,
    savings,
    savingAmountHistory,
    savingsAccounts,
    savingsHistory,
    sources,
  ]);

  const legacyMigrationRecordCount = legacyMigrationData ? countPersistedRecords(legacyMigrationData) : 0;
  const legacyMigrationAvailable = Boolean(
    currentUserId
    && hydrated
    && legacyMigrationData
    && !legacyMigrationDismissed
    && legacyMigrationRecordCount > 0,
  );

  async function importLegacyLocalData(): Promise<void> {
    if (!currentUserId || !legacyMigrationData || legacyMigrationInProgress) return;

    setLegacyMigrationInProgress(true);
    try {
      await savePersistedAppData(legacyMigrationData);
      applySnapshotToState(legacyMigrationData, {
        setBudgets,
        setSources,
        setEntries,
        setSalaryHistory,
        setPots,
        setExpenses,
        setSavings,
        setSavingAmountHistory,
        setMortgages,
        setMortgagePayments,
        setProperties,
        setSavingsAccounts,
        setSavingsHistory,
        setDebts,
        setDebtTransactions,
        setDebtHistory,
        setPensions,
        setPensionHistory,
      });
      if (legacyMigrationImportedKey) {
        saveLocalValue(legacyMigrationImportedKey, true);
      }
      if (legacyMigrationDismissedKey) {
        removeLocalValue(legacyMigrationDismissedKey);
      }
      setLegacyMigrationData(null);
      setLegacyMigrationDismissed(true);
      setLegacyMigrationRequiresConfirmation(false);
    } finally {
      setLegacyMigrationInProgress(false);
    }
  }

  function dismissLegacyMigration(): void {
    if (legacyMigrationDismissedKey) {
      saveLocalValue(legacyMigrationDismissedKey, true);
    }
    setLegacyMigrationDismissed(true);
  }

  const store: AppStore = {
    hydrated,
    currentUserId,
    accessibleUsers,
    legacyMigrationAvailable,
    legacyMigrationRequiresConfirmation,
    legacyMigrationInProgress,
    legacyMigrationRecordCount,
    importLegacyLocalData,
    dismissLegacyMigration,

    // Budget
    budgets: visibleBudgets, activeBudgetMonth,
    sources: visibleSources,
    entries: visibleEntries,
    salaryHistory: visibleSalaryHistory,
    pots: visiblePots,
    expenses: visibleExpenses,
    savings: visibleSavings,
    savingAmountHistory: visibleSavingAmountHistory,

    upsertBudget: b => setBudgets(prev => {
      const nextBudget = decorateBudgetItemsWithLabels(
        sanitizeBudgetForOneOffExpenses(b, visibleExpenses),
        visiblePots,
        visibleSources,
      );
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
        const budget = decorateBudgetItemsWithLabels(
          sanitizeBudgetForOneOffExpenses(
            createBudget(month, visibleNextExpenses, visibleSavings, visibleSavingAmountHistory),
            visibleNextExpenses,
          ),
          visiblePots,
          visibleSources,
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
        if (budget.locked) return budget;
        return decorateBudgetItemsWithLabels(
          sanitizeBudgetForOneOffExpenses(
            refreshBudget(budget, visibleNextExpenses, visibleSavings, visibleSavingAmountHistory),
            visibleNextExpenses,
          ),
          visiblePots,
          visibleSources,
        );
      }));
    },
    moveBudgetItem: (month, itemId, newPotId) => setBudgets(prev =>
      prev.map(b => b.month !== month ? b : {
        ...b,
        items: b.items.map(i => i.id === itemId ? {
          ...i,
          potId: newPotId,
          potName: visiblePots.find(pot => pot.id === newPotId)?.name ?? i.potName,
        } : i),
      })
    ),
    setBudgetItemIncomeSource: (month, itemId, incomeSourceId) => setBudgets(prev =>
      prev.map(b => b.month !== month ? b : {
        ...b,
        items: b.items.map(i => i.id === itemId ? {
          ...i,
          incomeSourceId: incomeSourceId as typeof i.incomeSourceId,
          incomeSourceName: visibleSources.find(source => source.id === incomeSourceId)?.provider ?? i.incomeSourceName,
        } : i),
      })
    ),
    setActiveBudgetMonth: month => setActiveBudgetMonth(month),
    deleteBudget:      month => setBudgets(prev => prev.filter(b => b.month !== month)),
    setBudgetArchived: (month, v) => setBudgets(prev => prev.map(b => b.month !== month ? b : { ...b, archived: v })),
    setBudgetLocked:   (month, v) => setBudgets(prev => prev.map(b => {
      if (b.month !== month) return b;
      if (!v) return { ...b, locked: false, lockedSnapshot: null };

      const decorated = decorateBudgetItemsWithLabels(b, visiblePots, visibleSources);
      return {
        ...decorated,
        locked: true,
        lockedSnapshot: buildLockedBudgetSnapshot(
          calcBudget(decorated, visiblePots, visibleSources, visibleEntries),
        ),
      };
    })),

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
            ? decorateBudgetItemsWithLabels(syncOneOffExpenseIntoBudget(budget, nextExpense), visiblePots, visibleSources)
            : budget
        ));
      } else if (existing?.oneOffPayment && existing.oneOffAppliedBudgetMonth) {
        const appliedMonth = existing.oneOffAppliedBudgetMonth;
        setBudgets(prev => prev.map(budget =>
          budget.month === appliedMonth
            ? decorateBudgetItemsWithLabels(syncOneOffExpenseIntoBudget(budget, {
                ...nextExpense,
                oneOffPayment: true,
                oneOffAppliedBudgetMonth: appliedMonth,
              }), visiblePots, visibleSources)
            : budget
        ));
      }
    },
    upsertSaving:  s  => setSavings(prev  => upsert(prev, {
      ...s,
      ownerUserIds: normalizeOwnerUserIds(s.ownerUserIds, currentUserId),
    })),
    upsertSavingAmountHistory: h => setSavingAmountHistory(prev => upsert(prev, h)),
    removeSavingAmountHistory: id => setSavingAmountHistory(prev => prev.filter(entry => entry.id !== id)),

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
