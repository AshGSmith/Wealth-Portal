import type { IncomeSourceType } from './constants';

// ─── Branded ID types ────────────────────────────────────────────────────────
// Prevents accidentally passing a PotId where an IncomeSourceId is expected.

type Brand<T, B extends string> = T & { readonly __brand: B };

export type BudgetId           = Brand<string, 'BudgetId'>;
export type ExpenseId          = Brand<string, 'ExpenseId'>;
export type SavingId           = Brand<string, 'SavingId'>;
export type PotId              = Brand<string, 'PotId'>;
export type IncomeSourceId     = Brand<string, 'IncomeSourceId'>;
export type IncomeEntryId      = Brand<string, 'IncomeEntryId'>;
export type SalaryHistoryId    = Brand<string, 'SalaryHistoryId'>;

// Wealth
export type PropertyId         = Brand<string, 'PropertyId'>;
export type MortgageId         = Brand<string, 'MortgageId'>;
export type MortgagePaymentId  = Brand<string, 'MortgagePaymentId'>;
export type SavingsAccountId   = Brand<string, 'SavingsAccountId'>;
export type SavingsHistoryId   = Brand<string, 'SavingsHistoryId'>;
export type DebtId             = Brand<string, 'DebtId'>;
export type DebtHistoryId      = Brand<string, 'DebtHistoryId'>;
export type DebtTransactionId  = Brand<string, 'DebtTransactionId'>;
export type PensionId          = Brand<string, 'PensionId'>;
export type PensionHistoryId   = Brand<string, 'PensionHistoryId'>;

// ─── Shared primitives ───────────────────────────────────────────────────────

/** ISO month string: "YYYY-MM" */
export type YearMonth = string;

/** ISO date string: "YYYY-MM-DD" */
export type ISODate = string;
export type DebtType = 'loan' | 'credit-card';
export type DebtHistoryType = 'snapshot' | 'purchase' | 'payment';
export type DebtTransactionType = 'purchase' | 'payment';

export type { IncomeSourceType } from './constants';

// ─── Entities ────────────────────────────────────────────────────────────────

/**
 * A monthly budget plan.
 * Acts as a top-level container for a given month. Expenses and Savings are
 * considered "active" in a Budget when their date range overlaps its month.
 */
export interface Budget {
  id:       BudgetId;
  month:    YearMonth;   // "YYYY-MM"
  archived: boolean;
}

/**
 * An income stream (e.g. "Acme Corp salary", "Freelance clients").
 * Parent of: Pot, IncomeEntry
 */
export interface IncomeSource {
  id:                   IncomeSourceId;
  type:                 IncomeSourceType;
  provider:             string;        // human label, e.g. "Acme Corp"
  startingAnnualSalary: number | null;
  archived:             boolean;
}

/**
 * A dated annual salary change for an IncomeSource.
 * Intended for salary history, trend charts, and reporting.
 */
export interface SalaryHistory {
  id:             SalaryHistoryId;
  incomeSourceId: IncomeSourceId;  // → IncomeSource
  annualSalary:   number;
  effectiveDate:  ISODate;
  note?:          string | null;
}

/**
 * A single payment received from an IncomeSource.
 * Many IncomeEntries belong to one IncomeSource.
 */
export interface IncomeEntry {
  id:             IncomeEntryId;
  incomeSourceId: IncomeSourceId;  // → IncomeSource
  amount:         number;          // positive, in base currency units
  date:           ISODate;         // "YYYY-MM-DD"
}

/**
 * A named allocation bucket funded by one IncomeSource.
 * Groups related Expenses and Savings under a single income stream.
 */
export interface Pot {
  id:             PotId;
  name:           string;
  incomeSourceId: IncomeSourceId;  // → IncomeSource
  isBusiness:     boolean;
  archived:       boolean;
}

/**
 * Shared shape for Expense and Saving line items.
 * startDate/endDate define the active window; both null = open-ended / ongoing.
 */
interface LineItem {
  id:        string;
  name:      string;
  amount:    number;    // positive, in base currency units
  potId:     PotId;     // → Pot
  startDate: ISODate | null;
  endDate:   ISODate | null;
  isCritical: boolean;  // flags non-negotiable items (rent, insurance, etc.)
  archived:  boolean;
}

/**
 * A recurring or one-off spending commitment drawn from a Pot.
 */
export interface Expense extends LineItem {
  id: ExpenseId;
  oneOffPayment: boolean;
  oneOffAppliedBudgetMonth: YearMonth | null;
}

/**
 * A recurring or one-off savings allocation drawn from a Pot.
 * Identical structure to Expense — kept separate for domain clarity.
 */
export interface Saving extends LineItem {
  id: SavingId;
}

// ─── Relationships (summary) ─────────────────────────────────────────────────
//
//  IncomeSource  ──< IncomeEntry     (one source, many payment entries)
//  IncomeSource  ──< Pot             (one source funds many pots)
//  Pot           ──< Expense         (one pot, many expenses)
//  Pot           ──< Saving          (one pot, many savings)
//  Budget        (month overlay)     (a Budget month selects all LineItems
//                                     whose startDate/endDate window overlaps)
//
// ─── Aggregate helpers ───────────────────────────────────────────────────────

/** All line items for a single Pot within a Budget month. */
export interface PotSummary {
  pot:      Pot;
  expenses: Expense[];
  savings:  Saving[];
  /** Sum of all IncomeEntry.amount for this pot's IncomeSource in the month. */
  income:   number;
}

/** Full resolved state for one Budget month. */
export interface BudgetSummary {
  budget: Budget;
  pots:   PotSummary[];
}

// ─── Wealth entities ─────────────────────────────────────────────────────────

/**
 * A mortgage product. Standalone — linked to a Property via Property.mortgageId.
 * Parent of: MortgagePayment
 */
export interface Mortgage {
  id:               MortgageId;
  lender:           string;
  amountBorrowed:   number;         // original loan amount
  interestRate:     number;         // annual rate as decimal, e.g. 0.045 = 4.5%
  termMonths:       number;
  startDate?:       ISODate | null; // used to compute fixed-term expiry
  fixedTermMonths?: number | null;  // optional fixed-rate period length in months
  archived:         boolean;
}

/**
 * A single repayment recorded against a Mortgage.
 * Many MortgagePayments belong to one Mortgage.
 */
export interface MortgagePayment {
  id:         MortgagePaymentId;
  mortgageId: MortgageId;   // → Mortgage
  amount:     number;
  date:       ISODate;
}

/**
 * A property asset.
 * Optionally linked to a Mortgage via mortgageId.
 */
export interface Property {
  id:               PropertyId;
  name:             string;
  address:          string;
  purchaseDate:     ISODate;
  purchasePrice:    number;
  currentValue:     number;
  mortgageId:       MortgageId | null;  // → Mortgage (null = unencumbered)
  isMainResidence:  boolean;
  isRental:         boolean;
  archived:         boolean;
}

/**
 * A savings or cash account.
 * Parent of: SavingsHistory (point-in-time balance snapshots)
 */
export interface SavingsAccount {
  id:              SavingsAccountId;
  name:            string;
  currentBalance:  number;
  interestRate:    number;   // annual rate as decimal
  archived:        boolean;
}

/**
 * A balance snapshot for a SavingsAccount at a given date.
 */
export interface SavingsHistory {
  id:               SavingsHistoryId;
  savingsAccountId: SavingsAccountId;  // → SavingsAccount
  balance:          number;
  date:             ISODate;
}

/**
 * A liability (loan, credit card, etc.).
 * Parent of: DebtHistory (point-in-time balance snapshots)
 */
export interface Debt {
  id:             DebtId;
  debtType:       DebtType;
  name:           string;
  provider:       string;
  borrowedAmount: number | null;   // original amount
  currentBalance: number;          // authoritative live balance
  interestRate:   number;          // annual rate as decimal
  termMonths:     number | null;
  startDate:      ISODate | null;
  archived:       boolean;
}

/**
 * A balance snapshot for a Debt at a given date.
 */
export interface DebtHistory {
  id:      DebtHistoryId;
  debtId:  DebtId;     // → Debt
  balance: number;
  date:    ISODate;
  type?:   DebtHistoryType;
  amount?: number | null;
  note?:   string | null;
}

/**
 * A credit-card transaction that changes the live debt balance.
 */
export interface DebtTransaction {
  id:      DebtTransactionId;
  debtId:  DebtId;     // → Debt
  type:    DebtTransactionType;
  amount:  number;
  date:    ISODate;
  note?:   string | null;
}

/**
 * A pension pot.
 * Parent of: PensionHistory (point-in-time balance snapshots)
 */
export interface Pension {
  id:             PensionId;
  name:           string;
  provider:       string;
  currentBalance: number;
  archived:       boolean;
}

/**
 * A balance snapshot for a Pension at a given date.
 */
export interface PensionHistory {
  id:        PensionHistoryId;
  pensionId: PensionId;  // → Pension
  balance:   number;
  date:      ISODate;
}

// ─── Wealth relationships (summary) ──────────────────────────────────────────
//
//  Mortgage        ──< MortgagePayment   (one mortgage, many payments)
//  Property        ──o Mortgage          (optional 1:1 — property may have a mortgage)
//  SavingsAccount  ──< SavingsHistory    (one account, many balance snapshots)
//  Debt            ──< DebtHistory       (one debt, many balance snapshots)
//  Pension         ──< PensionHistory    (one pension, many balance snapshots)
//
//  History tables are append-only snapshots; currentBalance on the parent
//  entity is the authoritative live value — history is for trend charting.
