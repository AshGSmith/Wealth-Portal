import type { IncomeSourceType } from './constants';

// ─── Branded ID types ────────────────────────────────────────────────────────
// Prevents accidentally passing a PotId where an IncomeSourceId is expected.

type Brand<T, B extends string> = T & { readonly __brand: B };

export type BudgetId           = Brand<string, 'BudgetId'>;
export type ExpenseId          = Brand<string, 'ExpenseId'>;
export type SubscriptionId     = Brand<string, 'SubscriptionId'>;
export type SubscriptionPriceHistoryId = Brand<string, 'SubscriptionPriceHistoryId'>;
export type SavingId           = Brand<string, 'SavingId'>;
export type SavingAmountHistoryId = Brand<string, 'SavingAmountHistoryId'>;
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
export type PensionPaymentId   = Brand<string, 'PensionPaymentId'>;
export type InvestmentHoldingId = Brand<string, 'InvestmentHoldingId'>;
export type InvestmentPurchaseId = Brand<string, 'InvestmentPurchaseId'>;
export type InvestmentValuationHistoryId = Brand<string, 'InvestmentValuationHistoryId'>;

// ─── Shared primitives ───────────────────────────────────────────────────────

/** ISO month string: "YYYY-MM" */
export type YearMonth = string;

/** ISO date string: "YYYY-MM-DD" */
export type ISODate = string;
export type DebtType = 'loan' | 'credit-card';
export type DebtHistoryType = 'snapshot' | 'purchase' | 'payment';
export type DebtTransactionType = 'purchase' | 'payment';
export type InvestmentPerShareCurrency = 'GBP' | 'USD';
export type SubscriptionCurrency = 'GBP' | 'USD';
export type SubscriptionPaymentSchedule = 'Weekly' | 'Monthly' | 'Yearly';
export type SubscriptionCategory = 'Streaming' | 'Storage' | 'Utility' | 'Transport' | 'Finance' | 'Health' | 'Business' | 'Other';
export type SubscriptionStatus = 'Current' | 'Cancelled';
export type SubscriptionPaymentMethod = 'Direct Debit' | 'Card';

export type { IncomeSourceType } from './constants';

// ─── Entities ────────────────────────────────────────────────────────────────

interface OwnedRecord {
  ownerUserIds: string[];
}

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
 * An income stream (e.g. "Civica salary", "Freelance clients").
 * Parent of: IncomeEntry
 */
export interface IncomeSource extends OwnedRecord {
  id:                   IncomeSourceId;
  type:                 IncomeSourceType;
  provider:             string;        // human label, e.g. "Civica"
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
 * A dated income period or one-off payment received from an IncomeSource.
 * For recurring income types, `date` acts as the start date and `endDate`
 * closes the period when present. Expense reimbursements remain one-off.
 */
export interface IncomeEntry {
  id:             IncomeEntryId;
  incomeSourceId: IncomeSourceId;  // → IncomeSource
  amount:         number;          // positive, in base currency units
  date:           ISODate;         // start date, "YYYY-MM-DD"
  endDate:        ISODate | null;
}

/**
 * A named allocation bucket for grouping budget items.
 */
export interface Pot {
  id:         PotId;
  name:       string;
  isBusiness: boolean;
  ownerUserIds: string[];
  archived:   boolean;
}

/**
 * Shared shape for Expense and Saving line items.
 * startDate/endDate define the active window; both null = open-ended / ongoing.
 */
interface LineItem extends OwnedRecord {
  id:             string;
  name:           string;
  amount:         number;          // positive, in base currency units
  potId:          PotId;           // → Pot
  incomeSourceId: IncomeSourceId;  // → IncomeSource
  startDate:      ISODate | null;
  endDate:        ISODate | null;
  isCritical:     boolean;         // flags non-negotiable items (rent, insurance, etc.)
  archived:       boolean;
}

/**
 * A recurring or one-off spending commitment drawn from a Pot.
 */
export interface Expense extends LineItem {
  id: ExpenseId;
  oneOffPayment: boolean;
  oneOffAppliedBudgetMonth: YearMonth | null;
}

export interface Subscription extends OwnedRecord {
  id: SubscriptionId;
  name: string;
  cost: number;
  currency: SubscriptionCurrency;
  paymentDate: ISODate;
  paymentSchedule: SubscriptionPaymentSchedule;
  freeTrial: boolean;
  freeTrialExpiryDate: ISODate | null;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  endDate: ISODate | null;
  paymentMethod: SubscriptionPaymentMethod;
  potId: PotId;
  incomeSourceId: IncomeSourceId;
  isCriticalExpense: boolean;
  archived: boolean;
}

export interface SubscriptionPriceHistory {
  id: SubscriptionPriceHistoryId;
  subscriptionId: SubscriptionId;
  cost: number;
  currency: SubscriptionCurrency;
  effectiveDate: ISODate;
}

/**
 * A recurring or one-off savings allocation drawn from a Pot.
 * Identical structure to Expense — kept separate for domain clarity.
 */
export interface Saving extends LineItem {
  id: SavingId;
}

/**
 * A dated amount change for a Saving.
 * The most recent effective record on or before a budget month overrides the
 * Saving's base/default amount for that month.
 */
export interface SavingAmountHistory {
  id: SavingAmountHistoryId;
  savingId: SavingId;
  amount: number;
  effectiveDate: ISODate;
}

// ─── Relationships (summary) ─────────────────────────────────────────────────
//
//  IncomeSource  ──< IncomeEntry     (one source, many payment entries)
//  Pot           ──< Expense         (one pot, many expenses)
//  Pot           ──< Saving          (one pot, many savings)
//  IncomeSource  ──< Expense         (one source can fund many expenses)
//  IncomeSource  ──< Saving          (one source can fund many savings)
//  Budget        (month overlay)     (a Budget month selects all LineItems
//                                     whose startDate/endDate window overlaps)
//
// ─── Aggregate helpers ───────────────────────────────────────────────────────

/** All line items for a single Pot within a Budget month. */
export interface PotSummary {
  pot:      Pot;
  expenses: Expense[];
  savings:  Saving[];
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
export interface Mortgage extends OwnedRecord {
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
export interface Property extends OwnedRecord {
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
export interface SavingsAccount extends OwnedRecord {
  id:              SavingsAccountId;
  name:            string;
  currentBalance:  number;
  targetSavingsAmount: number | null;
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
export interface Debt extends OwnedRecord {
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
export interface Pension extends OwnedRecord {
  id:             PensionId;
  name:           string;
  provider:       string;
  currentBalance: number;
  initialInvestment: number | null;
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

/**
 * A pension contribution payment for a Pension.
 */
export interface PensionPayment {
  id:                    PensionPaymentId;
  pensionId:             PensionId;  // → Pension
  date:                  ISODate;
  employeeContribution:  number;
  employerContribution:  number;
  note?:                 string | null;
}

export interface InvestmentInstrumentSelection {
  symbol: string;
  quoteSymbol: string;
  ticker?: string | null;
  providerSymbol?: string | null;
  yahooSymbol?: string | null;
  displayName: string;
  exchange: string | null;
  currency: string | null;
  source: string | null;
  sourceId: string | null;
}

/**
 * An investment holding such as a stock, fund, or ETF.
 * Parent of: InvestmentPurchase, InvestmentValuationHistory
 */
export interface InvestmentHolding extends OwnedRecord {
  id:             InvestmentHoldingId;
  name:           string;
  tickerOrSymbol: string;
  quoteSymbol:    string;
  selectedInstrument: InvestmentInstrumentSelection | null;
  provider:       string | null;
  archived:       boolean;
}

/**
 * A purchase made into an InvestmentHolding.
 */
export interface InvestmentPurchase {
  id:              InvestmentPurchaseId;
  investmentId:    InvestmentHoldingId;  // → InvestmentHolding
  purchaseDate:    ISODate;
  amountInvested:  number;
  sharesPurchased: number | null;
  perSharePrice:   number | null;
  perShareCurrency: InvestmentPerShareCurrency | null;
  perSharePriceGbp: number | null;
  exchangeRateToGbp: number | null;
  exchangeRateDate: ISODate | null;
  note?:           string | null;
}

/**
 * A dated valuation snapshot for an InvestmentHolding.
 * The latest valuation is the current value for reporting and wealth totals.
 */
export interface InvestmentValuationHistory {
  id:            InvestmentValuationHistoryId;
  investmentId:  InvestmentHoldingId;  // → InvestmentHolding
  valuationDate: ISODate;
  currentValue:  number;
  note?:         string | null;
}

// ─── Wealth relationships (summary) ──────────────────────────────────────────
//
//  Mortgage        ──< MortgagePayment   (one mortgage, many payments)
//  Property        ──o Mortgage          (optional 1:1 — property may have a mortgage)
//  SavingsAccount  ──< SavingsHistory    (one account, many balance snapshots)
//  Debt            ──< DebtHistory       (one debt, many balance snapshots)
//  Pension         ──< PensionHistory    (one pension, many balance snapshots)
//  InvestmentHolding ──< InvestmentPurchase         (one holding, many purchases)
//  InvestmentHolding ──< InvestmentValuationHistory (one holding, many valuations)
//
//  History tables are append-only snapshots; currentBalance on the parent
//  entity is the authoritative live value — history is for trend charting.
