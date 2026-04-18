import { resolveItemsForMonth, type LocalBudget } from './budgetLogic';
import type {
  Budget, IncomeSource, IncomeEntry, Pot, Expense, Saving, SalaryHistory,
  BudgetId, IncomeSourceId, IncomeEntryId, PotId, ExpenseId, SavingId, SalaryHistoryId,
  Mortgage, MortgagePayment, Property,
  SavingsAccount, SavingsHistory,
  Debt, DebtHistory,
  DebtTransaction,
  Pension, PensionHistory,
  MortgageId, MortgagePaymentId, PropertyId,
  SavingsAccountId, SavingsHistoryId,
  DebtId, DebtHistoryId,
  PensionId, PensionHistoryId,
} from './types';

const id = <T extends string>(v: string) => v as unknown as T;

// ─── Budget ──────────────────────────────────────────────────────────────────

export const MOCK_BUDGET: Budget = {
  id: id<BudgetId>('b1'),
  month: '2026-04',
  archived: false,
};


// ─── Income sources ───────────────────────────────────────────────────────────

export const MOCK_INCOME_SOURCES: IncomeSource[] = [
  { id: id<IncomeSourceId>('is1'), type: 'salary',    provider: 'Acme Corp',     startingAnnualSalary: 48000, archived: false },
  { id: id<IncomeSourceId>('is2'), type: 'business', provider: 'Design Studio', startingAnnualSalary: null,  archived: false },
];

export const MOCK_SALARY_HISTORY: SalaryHistory[] = [
  {
    id: id<SalaryHistoryId>('shy1'),
    incomeSourceId: id<IncomeSourceId>('is1'),
    annualSalary: 52000,
    effectiveDate: '2025-04-01',
    note: 'Annual review',
  },
  {
    id: id<SalaryHistoryId>('shy2'),
    incomeSourceId: id<IncomeSourceId>('is1'),
    annualSalary: 54500,
    effectiveDate: '2026-04-01',
    note: 'Promotion uplift',
  },
];

// ─── Income entries (multi-month) ────────────────────────────────────────────

export const MOCK_INCOME_ENTRIES: IncomeEntry[] = [
  // March 2026
  { id: id<IncomeEntryId>('ie-0301'), incomeSourceId: id<IncomeSourceId>('is1'), amount: 4200, date: '2026-03-25' },
  { id: id<IncomeEntryId>('ie-0302'), incomeSourceId: id<IncomeSourceId>('is2'), amount:  800, date: '2026-03-12' },
  // April 2026
  { id: id<IncomeEntryId>('ie-0401'), incomeSourceId: id<IncomeSourceId>('is1'), amount: 4200, date: '2026-04-25' },
  { id: id<IncomeEntryId>('ie-0402'), incomeSourceId: id<IncomeSourceId>('is2'), amount: 1100, date: '2026-04-18' },
  // May 2026
  { id: id<IncomeEntryId>('ie-0501'), incomeSourceId: id<IncomeSourceId>('is1'), amount: 4200, date: '2026-05-25' },
  { id: id<IncomeEntryId>('ie-0502'), incomeSourceId: id<IncomeSourceId>('is2'), amount:  300, date: '2026-05-09' }, // light freelance month → triggers over-allocation
];

// ─── Pots ─────────────────────────────────────────────────────────────────────

export const MOCK_POTS: Pot[] = [
  { id: id<PotId>('p1'), name: 'Household',       incomeSourceId: id<IncomeSourceId>('is1'), isBusiness: false, archived: false },
  { id: id<PotId>('p2'), name: 'Personal',         incomeSourceId: id<IncomeSourceId>('is1'), isBusiness: false, archived: false },
  { id: id<PotId>('p3'), name: 'Goals & Savings',  incomeSourceId: id<IncomeSourceId>('is1'), isBusiness: false, archived: false },
  { id: id<PotId>('p4'), name: 'Freelance',        incomeSourceId: id<IncomeSourceId>('is2'), isBusiness: true,  archived: false },
];

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const MOCK_EXPENSES: Expense[] = [
  // Household (p1)
  { id: id<ExpenseId>('e1'), potId: id<PotId>('p1'), name: 'Rent',            amount: 1200, isCritical: true,  startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e2'), potId: id<PotId>('p1'), name: 'Electricity & Gas', amount: 95, isCritical: true,  startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e3'), potId: id<PotId>('p1'), name: 'Groceries',       amount: 380, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e4'), potId: id<PotId>('p1'), name: 'Broadband',        amount: 30, isCritical: true,  startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  // Personal (p2)
  { id: id<ExpenseId>('e5'), potId: id<PotId>('p2'), name: 'Transport',       amount: 165, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e6'), potId: id<PotId>('p2'), name: 'Gym membership',   amount: 45, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e7'), potId: id<PotId>('p2'), name: 'Clothing',         amount: 60, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e8'), potId: id<PotId>('p2'), name: 'Eating out',      amount: 120, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  // Freelance (p4)
  { id: id<ExpenseId>('e9'),  potId: id<PotId>('p4'), name: 'Adobe CC',        amount: 55, isCritical: true,  startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
  { id: id<ExpenseId>('e10'), potId: id<PotId>('p4'), name: 'Cloud hosting',   amount: 28, isCritical: false, startDate: null, endDate: null, archived: false, oneOffPayment: false, oneOffAppliedBudgetMonth: null },
];

// ─── Savings ──────────────────────────────────────────────────────────────────

export const MOCK_SAVINGS: Saving[] = [
  // Goals (p3)
  { id: id<SavingId>('s1'), potId: id<PotId>('p3'), name: 'Emergency fund',  amount: 300, isCritical: true,  startDate: null, endDate: null, archived: false },
  { id: id<SavingId>('s2'), potId: id<PotId>('p3'), name: 'Holiday',         amount: 150, isCritical: false, startDate: null, endDate: null, archived: false },
  { id: id<SavingId>('s3'), potId: id<PotId>('p3'), name: 'House deposit',   amount: 400, isCritical: true,  startDate: null, endDate: null, archived: false },
  // Freelance (p4)
  { id: id<SavingId>('s4'), potId: id<PotId>('p4'), name: 'Tax reserve',     amount: 220, isCritical: true,  startDate: null, endDate: null, archived: false },
];

export const MOCK_BUDGETS: LocalBudget[] = [{
  id:       'budget-2026-04',
  month:    '2026-04',
  archived: false,
  locked:   false,
  items:    resolveItemsForMonth('2026-04', MOCK_EXPENSES, MOCK_SAVINGS),
}];

// ─── Wealth — Mortgages ───────────────────────────────────────────────────────

export const MOCK_MORTGAGES: Mortgage[] = [
  { id: id<MortgageId>('m1'), lender: 'Nationwide', amountBorrowed: 220000, interestRate: 0.039, termMonths: 300, startDate: '2024-05-01', fixedTermMonths: 24, archived: false },
];

export const MOCK_MORTGAGE_PAYMENTS: MortgagePayment[] = [
  { id: id<MortgagePaymentId>('mp1'), mortgageId: id<MortgageId>('m1'), amount: 1148, date: '2026-02-01' },
  { id: id<MortgagePaymentId>('mp2'), mortgageId: id<MortgageId>('m1'), amount: 1148, date: '2026-03-01' },
  { id: id<MortgagePaymentId>('mp3'), mortgageId: id<MortgageId>('m1'), amount: 1148, date: '2026-04-01' },
];

// ─── Wealth — Properties ──────────────────────────────────────────────────────

export const MOCK_PROPERTIES: Property[] = [
  {
    id: id<PropertyId>('pr1'),
    name: 'Home',
    address: '12 Maple Street, London, E1 6RF',
    purchaseDate: '2021-06-15',
    purchasePrice: 280000,
    currentValue: 325000,
    mortgageId: id<MortgageId>('m1'),
    isMainResidence: true,
    isRental: false,
    archived: false,
  },
];

// ─── Wealth — Savings accounts ────────────────────────────────────────────────

export const MOCK_SAVINGS_ACCOUNTS: SavingsAccount[] = [
  { id: id<SavingsAccountId>('sa1'), name: 'Marcus Easy Access',  currentBalance: 8500,  interestRate: 0.045, archived: false },
  { id: id<SavingsAccountId>('sa2'), name: 'HSBC Fixed Rate ISA', currentBalance: 15000, interestRate: 0.048, archived: false },
];

export const MOCK_SAVINGS_HISTORY: SavingsHistory[] = [
  { id: id<SavingsHistoryId>('sh1'), savingsAccountId: id<SavingsAccountId>('sa1'), balance: 7200,  date: '2026-01-31' },
  { id: id<SavingsHistoryId>('sh2'), savingsAccountId: id<SavingsAccountId>('sa1'), balance: 7800,  date: '2026-02-28' },
  { id: id<SavingsHistoryId>('sh3'), savingsAccountId: id<SavingsAccountId>('sa1'), balance: 8200,  date: '2026-03-31' },
  { id: id<SavingsHistoryId>('sh4'), savingsAccountId: id<SavingsAccountId>('sa1'), balance: 8500,  date: '2026-04-18' },
  { id: id<SavingsHistoryId>('sh5'), savingsAccountId: id<SavingsAccountId>('sa2'), balance: 15000, date: '2026-01-31' },
];

// ─── Wealth — Debts ───────────────────────────────────────────────────────────

export const MOCK_DEBTS: Debt[] = [
  {
    id: id<DebtId>('d1'),
    debtType: 'loan',
    name: 'Car finance',
    provider: 'Black Horse',
    borrowedAmount: 12000,
    currentBalance: 7400,
    interestRate: 0.069,
    termMonths: 48,
    startDate: '2023-06-01',
    archived: false,
  },
  {
    id: id<DebtId>('d2'),
    debtType: 'loan',
    name: 'Personal loan',
    provider: 'Monzo',
    borrowedAmount: 5000,
    currentBalance: 2100,
    interestRate: 0.149,
    termMonths: 36,
    startDate: '2024-01-15',
    archived: false,
  },
];

export const MOCK_DEBT_TRANSACTIONS: DebtTransaction[] = [];

export const MOCK_DEBT_HISTORY: DebtHistory[] = [
  { id: id<DebtHistoryId>('dh1'), debtId: id<DebtId>('d1'), balance: 8600, date: '2026-01-31', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh2'), debtId: id<DebtId>('d1'), balance: 8100, date: '2026-02-28', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh3'), debtId: id<DebtId>('d1'), balance: 7750, date: '2026-03-31', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh4'), debtId: id<DebtId>('d1'), balance: 7400, date: '2026-04-18', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh5'), debtId: id<DebtId>('d2'), balance: 2800, date: '2026-01-31', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh6'), debtId: id<DebtId>('d2'), balance: 2500, date: '2026-02-28', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh7'), debtId: id<DebtId>('d2'), balance: 2300, date: '2026-03-31', type: 'snapshot', amount: null, note: null },
  { id: id<DebtHistoryId>('dh8'), debtId: id<DebtId>('d2'), balance: 2100, date: '2026-04-18', type: 'snapshot', amount: null, note: null },
];

// ─── Wealth — Pensions ────────────────────────────────────────────────────────

export const MOCK_PENSIONS: Pension[] = [
  { id: id<PensionId>('pe1'), name: 'Workplace Pension', provider: 'Nest',      currentBalance: 42000, archived: false },
  { id: id<PensionId>('pe2'), name: 'Private SIPP',      provider: 'Vanguard',  currentBalance: 18500, archived: false },
];

export const MOCK_PENSION_HISTORY: PensionHistory[] = [
  { id: id<PensionHistoryId>('peh1'), pensionId: id<PensionId>('pe1'), balance: 38000, date: '2026-01-31' },
  { id: id<PensionHistoryId>('peh2'), pensionId: id<PensionId>('pe1'), balance: 39500, date: '2026-02-28' },
  { id: id<PensionHistoryId>('peh3'), pensionId: id<PensionId>('pe1'), balance: 41200, date: '2026-03-31' },
  { id: id<PensionHistoryId>('peh4'), pensionId: id<PensionId>('pe1'), balance: 42000, date: '2026-04-18' },
  { id: id<PensionHistoryId>('peh5'), pensionId: id<PensionId>('pe2'), balance: 16000, date: '2026-01-31' },
  { id: id<PensionHistoryId>('peh6'), pensionId: id<PensionId>('pe2'), balance: 17000, date: '2026-02-28' },
  { id: id<PensionHistoryId>('peh7'), pensionId: id<PensionId>('pe2'), balance: 17800, date: '2026-03-31' },
  { id: id<PensionHistoryId>('peh8'), pensionId: id<PensionId>('pe2'), balance: 18500, date: '2026-04-18' },
];
