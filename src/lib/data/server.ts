import 'server-only';

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type {
  Debt,
  DebtHistory,
  DebtTransaction,
  Expense,
  IncomeEntry,
  IncomeSource,
  Mortgage,
  MortgagePayment,
  Pension,
  PensionHistory,
  Pot,
  Property,
  SalaryHistory,
  Saving,
  SavingsAccount,
  SavingsHistory,
} from '@/lib/types';
import type { LocalBudget, ResolvedLineItem } from '@/lib/budgetLogic';

const DATA_DIR = join(process.cwd(), '.data');
const DB_PATH = join(DATA_DIR, 'wealth-portal.sqlite');
const APP_DATA_ROW_ID = 1;

let dbInstance: Database.Database | null = null;

export interface PersistedAppData {
  budgets: LocalBudget[];
  sources: IncomeSource[];
  entries: IncomeEntry[];
  salaryHistory: SalaryHistory[];
  pots: Pot[];
  expenses: Expense[];
  savings: Saving[];
  mortgages: Mortgage[];
  mortgagePayments: MortgagePayment[];
  properties: Property[];
  savingsAccounts: SavingsAccount[];
  savingsHistory: SavingsHistory[];
  debts: Debt[];
  debtTransactions: DebtTransaction[];
  debtHistory: DebtHistory[];
  pensions: Pension[];
  pensionHistory: PensionHistory[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_data_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

export function emptyPersistedAppData(): PersistedAppData {
  return {
    budgets: [],
    sources: [],
    entries: [],
    salaryHistory: [],
    pots: [],
    expenses: [],
    savings: [],
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

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizePersistedAppData(value: unknown): PersistedAppData {
  const raw = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};

  return {
    budgets: readArray<LocalBudget>(raw.budgets),
    sources: readArray<IncomeSource>(raw.sources),
    entries: readArray<IncomeEntry>(raw.entries),
    salaryHistory: readArray<SalaryHistory>(raw.salaryHistory),
    pots: readArray<Pot>(raw.pots),
    expenses: readArray<Expense>(raw.expenses),
    savings: readArray<Saving>(raw.savings),
    mortgages: readArray<Mortgage>(raw.mortgages),
    mortgagePayments: readArray<MortgagePayment>(raw.mortgagePayments),
    properties: readArray<Property>(raw.properties),
    savingsAccounts: readArray<SavingsAccount>(raw.savingsAccounts),
    savingsHistory: readArray<SavingsHistory>(raw.savingsHistory),
    debts: readArray<Debt>(raw.debts),
    debtTransactions: readArray<DebtTransaction>(raw.debtTransactions),
    debtHistory: readArray<DebtHistory>(raw.debtHistory),
    pensions: readArray<Pension>(raw.pensions),
    pensionHistory: readArray<PensionHistory>(raw.pensionHistory),
  };
}

export function getPersistedAppData(): PersistedAppData {
  const row = getDb().prepare('SELECT payload FROM app_data_state WHERE id = ?').get(APP_DATA_ROW_ID) as { payload: string } | undefined;
  if (!row) return emptyPersistedAppData();

  try {
    return normalizePersistedAppData(JSON.parse(row.payload));
  } catch {
    return emptyPersistedAppData();
  }
}

function writePersistedAppData(data: PersistedAppData): void {
  getDb().prepare(`
    INSERT INTO app_data_state (id, payload, updated_at)
    VALUES (@id, @payload, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run({
    id: APP_DATA_ROW_ID,
    payload: JSON.stringify(data),
    updated_at: nowIso(),
  });
}

function normalizeOwnerUserIds(ownerUserIds: string[] | null | undefined): string[] {
  return [...new Set((ownerUserIds ?? []).filter(Boolean))];
}

function isRecordVisible(record: { ownerUserIds: string[] }, accessibleUserIds: string[]): boolean {
  if (accessibleUserIds.length === 0) return false;
  return record.ownerUserIds.some(userId => accessibleUserIds.includes(userId));
}

function filterOwnedRecords<T extends { ownerUserIds: string[] }>(records: T[], accessibleUserIds: string[]): T[] {
  return records.filter(record => isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(record.ownerUserIds) }, accessibleUserIds));
}

function isBudgetItemVisible(item: ResolvedLineItem, accessibleUserIds: string[]): boolean {
  return isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(item.ownerUserIds ?? item.defaultOwnerUserIds) }, accessibleUserIds);
}

function isBudgetVisible(budget: LocalBudget, accessibleUserIds: string[]): boolean {
  const budgetOwnerIds = normalizeOwnerUserIds(budget.ownerUserIds);
  if (budgetOwnerIds.length > 0 && isRecordVisible({ ownerUserIds: budgetOwnerIds }, accessibleUserIds)) {
    return true;
  }

  return budget.items.some(item => isBudgetItemVisible(item, accessibleUserIds));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function visibleBudgetMonths(budgets: LocalBudget[], accessibleUserIds: string[]): Set<string> {
  return new Set(
    budgets
      .filter(budget => isBudgetVisible(budget, accessibleUserIds))
      .map(budget => budget.month),
  );
}

function mergeOwnedRecords<T extends { id: string; ownerUserIds: string[] }>(
  current: T[],
  nextVisible: T[],
  accessibleUserIds: string[],
): T[] {
  const preserved = current.filter(record => !isRecordVisible({ ownerUserIds: normalizeOwnerUserIds(record.ownerUserIds) }, accessibleUserIds));
  return uniqueById([...preserved, ...nextVisible]);
}

function mergeLinkedRecords<T extends { id: string }, P extends string>(
  current: T[],
  nextVisible: T[],
  currentParentIds: Set<P>,
): T[] {
  const preserved = current.filter(record => !currentParentIds.has((record as Record<string, unknown>).incomeSourceId as P)
    && !currentParentIds.has((record as Record<string, unknown>).mortgageId as P)
    && !currentParentIds.has((record as Record<string, unknown>).savingsAccountId as P)
    && !currentParentIds.has((record as Record<string, unknown>).debtId as P)
    && !currentParentIds.has((record as Record<string, unknown>).pensionId as P));

  return uniqueById([...preserved, ...nextVisible]);
}

function collectBudgetOwnerUserIds(items: ResolvedLineItem[]): string[] {
  return [...new Set(items.flatMap(item => normalizeOwnerUserIds(item.ownerUserIds ?? item.defaultOwnerUserIds)))];
}

function mergeBudgets(
  current: LocalBudget[],
  nextVisible: LocalBudget[],
  accessibleUserIds: string[],
): LocalBudget[] {
  const visibleMonths = new Set([
    ...visibleBudgetMonths(current, accessibleUserIds),
    ...nextVisible.map(budget => budget.month),
  ]);

  const currentByMonth = new Map(current.map(budget => [budget.month, budget]));
  const nextByMonth = new Map(nextVisible.map(budget => [budget.month, budget]));
  const merged: LocalBudget[] = current.filter(budget => !visibleMonths.has(budget.month));

  for (const month of visibleMonths) {
    const existing = currentByMonth.get(month);
    const submitted = nextByMonth.get(month);
    const preservedItems = existing?.items.filter(item => !isBudgetItemVisible(item, accessibleUserIds)) ?? [];

    if (!submitted) {
      if (!existing || preservedItems.length === 0) continue;
      merged.push({
        ...existing,
        items: preservedItems,
        ownerUserIds: collectBudgetOwnerUserIds(preservedItems),
      });
      continue;
    }

    const items = uniqueById([...preservedItems, ...submitted.items]);
    merged.push({
      ...submitted,
      items,
      ownerUserIds: [...new Set([
        ...normalizeOwnerUserIds(submitted.ownerUserIds),
        ...collectBudgetOwnerUserIds(items),
      ])],
    });
  }

  return merged.sort((a, b) => a.month.localeCompare(b.month));
}

export function filterPersistedAppDataForUser(
  data: PersistedAppData,
  accessibleUserIds: string[],
): PersistedAppData {
  const sources = filterOwnedRecords(data.sources, accessibleUserIds);
  const sourceIds = new Set(sources.map(source => source.id as string));
  const pots = filterOwnedRecords(data.pots, accessibleUserIds);
  const potIds = new Set(pots.map(pot => pot.id as string));
  const expenses = filterOwnedRecords(data.expenses, accessibleUserIds).filter(expense => potIds.has(expense.potId as string));
  const savings = filterOwnedRecords(data.savings, accessibleUserIds).filter(saving => potIds.has(saving.potId as string));
  const mortgages = filterOwnedRecords(data.mortgages, accessibleUserIds);
  const mortgageIds = new Set(mortgages.map(mortgage => mortgage.id as string));
  const properties = filterOwnedRecords(data.properties, accessibleUserIds).filter(property => !property.mortgageId || mortgageIds.has(property.mortgageId as string));
  const savingsAccounts = filterOwnedRecords(data.savingsAccounts, accessibleUserIds);
  const savingsAccountIds = new Set(savingsAccounts.map(account => account.id as string));
  const debts = filterOwnedRecords(data.debts, accessibleUserIds);
  const debtIds = new Set(debts.map(debt => debt.id as string));
  const pensions = filterOwnedRecords(data.pensions, accessibleUserIds);
  const pensionIds = new Set(pensions.map(pension => pension.id as string));

  return {
    budgets: data.budgets
      .filter(budget => isBudgetVisible(budget, accessibleUserIds))
      .map(budget => ({
        ...budget,
        items: budget.items.filter(item => isBudgetItemVisible(item, accessibleUserIds) && potIds.has(item.potId as string)),
      })),
    sources,
    entries: data.entries.filter(entry => sourceIds.has(entry.incomeSourceId as string)),
    salaryHistory: data.salaryHistory.filter(entry => sourceIds.has(entry.incomeSourceId as string)),
    pots,
    expenses,
    savings,
    mortgages,
    mortgagePayments: data.mortgagePayments.filter(payment => mortgageIds.has(payment.mortgageId as string)),
    properties,
    savingsAccounts,
    savingsHistory: data.savingsHistory.filter(entry => savingsAccountIds.has(entry.savingsAccountId as string)),
    debts,
    debtTransactions: data.debtTransactions.filter(entry => debtIds.has(entry.debtId as string)),
    debtHistory: data.debtHistory.filter(entry => debtIds.has(entry.debtId as string)),
    pensions,
    pensionHistory: data.pensionHistory.filter(entry => pensionIds.has(entry.pensionId as string)),
  };
}

export function savePersistedAppDataForUser(
  nextVisibleData: PersistedAppData,
  accessibleUserIds: string[],
): PersistedAppData {
  const current = getPersistedAppData();

  const visibleSourceIds = new Set(nextVisibleData.sources.map(source => source.id as string));
  const visibleMortgageIds = new Set(nextVisibleData.mortgages.map(mortgage => mortgage.id as string));
  const visibleSavingsAccountIds = new Set(nextVisibleData.savingsAccounts.map(account => account.id as string));
  const visibleDebtIds = new Set(nextVisibleData.debts.map(debt => debt.id as string));
  const visiblePensionIds = new Set(nextVisibleData.pensions.map(pension => pension.id as string));

  const merged: PersistedAppData = {
    budgets: mergeBudgets(current.budgets, nextVisibleData.budgets, accessibleUserIds),
    sources: mergeOwnedRecords(current.sources, nextVisibleData.sources, accessibleUserIds),
    entries: mergeLinkedRecords(current.entries, nextVisibleData.entries, visibleSourceIds),
    salaryHistory: mergeLinkedRecords(current.salaryHistory, nextVisibleData.salaryHistory, visibleSourceIds),
    pots: mergeOwnedRecords(current.pots, nextVisibleData.pots, accessibleUserIds),
    expenses: mergeOwnedRecords(current.expenses, nextVisibleData.expenses, accessibleUserIds),
    savings: mergeOwnedRecords(current.savings, nextVisibleData.savings, accessibleUserIds),
    mortgages: mergeOwnedRecords(current.mortgages, nextVisibleData.mortgages, accessibleUserIds),
    mortgagePayments: mergeLinkedRecords(current.mortgagePayments, nextVisibleData.mortgagePayments, visibleMortgageIds),
    properties: mergeOwnedRecords(current.properties, nextVisibleData.properties, accessibleUserIds),
    savingsAccounts: mergeOwnedRecords(current.savingsAccounts, nextVisibleData.savingsAccounts, accessibleUserIds),
    savingsHistory: mergeLinkedRecords(current.savingsHistory, nextVisibleData.savingsHistory, visibleSavingsAccountIds),
    debts: mergeOwnedRecords(current.debts, nextVisibleData.debts, accessibleUserIds),
    debtTransactions: mergeLinkedRecords(current.debtTransactions, nextVisibleData.debtTransactions, visibleDebtIds),
    debtHistory: mergeLinkedRecords(current.debtHistory, nextVisibleData.debtHistory, visibleDebtIds),
    pensions: mergeOwnedRecords(current.pensions, nextVisibleData.pensions, accessibleUserIds),
    pensionHistory: mergeLinkedRecords(current.pensionHistory, nextVisibleData.pensionHistory, visiblePensionIds),
  };

  writePersistedAppData(merged);
  return merged;
}

export function isPersistedAppDataEmpty(data: PersistedAppData): boolean {
  return Object.values(data).every(value => Array.isArray(value) && value.length === 0);
}
