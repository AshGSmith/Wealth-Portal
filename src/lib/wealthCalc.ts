import { useStore } from './store';
import type {
  Property, Mortgage, MortgagePayment,
  SavingsAccount, Debt, Pension,
} from './types';

// ─── Output types ─────────────────────────────────────────────────────────────

export interface WealthCalc {
  // Asset components
  propertyAssets:  number;
  savingsAssets:   number;
  pensionAssets:   number;
  totalAssets:     number;

  // Liability components
  mortgageLiabilities: number;
  debtLiabilities:     number;
  totalLiabilities:    number;

  // Summary
  netWorth: number;
}

export interface MortgageFixedTermAlert {
  mortgageId: string;
  lender: string;
  endDate: string;
  daysUntilEnd: number;
}

function currentIsoDate(): string {
  return isoDateFromLocalDate(new Date());
}

function isoDateFromLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function mortgageFixedTermEndDate(mortgage: Mortgage): string | null {
  if (!mortgage.startDate || !mortgage.fixedTermMonths) return null;
  return isoDateFromLocalDate(addMonths(parseIsoDate(mortgage.startDate), mortgage.fixedTermMonths));
}

export function isPropertyCurrentAsOf(property: Property, asOfIso: string): boolean {
  return !property.archived && property.purchaseDate <= asOfIso;
}

export function isMortgageCurrentAsOf(mortgage: Mortgage, asOfIso: string): boolean {
  return !mortgage.archived && (!mortgage.startDate || mortgage.startDate <= asOfIso);
}

export function mortgagesWithFixedTermEndingSoon(
  mortgages: Mortgage[],
  todayIso: string,
  daysAhead = 60,
): MortgageFixedTermAlert[] {
  const today = parseIsoDate(todayIso);

  return mortgages
    .filter(mortgage => !mortgage.archived)
    .flatMap(mortgage => {
      const endDate = mortgageFixedTermEndDate(mortgage);
      if (!endDate) return [];

      const daysUntilEnd = Math.ceil((parseIsoDate(endDate).getTime() - today.getTime()) / 86_400_000);
      if (daysUntilEnd < 0 || daysUntilEnd > daysAhead) return [];

      return [{
        mortgageId: mortgage.id as string,
        lender: mortgage.lender,
        endDate,
        daysUntilEnd,
      }];
    })
    .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd);
}

// ─── Atomic calculations ──────────────────────────────────────────────────────

/** Outstanding principal for one mortgage: borrowed minus all payments made. */
export function mortgageBalance(mortgage: Mortgage, payments: MortgagePayment[]): number {
  const paid = payments
    .filter(p => p.mortgageId === mortgage.id)
    .reduce((s, p) => s + p.amount, 0);
  return Math.max(0, mortgage.amountBorrowed - paid);
}

/**
 * Estimated interest accruing over the fixed-rate period.
 * Uses simple (non-amortising) interest: principal × rate × (months / 12).
 * Returns 0 if no fixed term is set.
 */
export function mortgageFixedTermInterest(mortgage: Mortgage, payments: MortgagePayment[]): number {
  if (!mortgage.fixedTermMonths) return 0;
  const principal = mortgageBalance(mortgage, payments);
  return principal * mortgage.interestRate * (mortgage.fixedTermMonths / 12);
}

/** Total liability for one mortgage: outstanding principal + fixed-term interest. */
export function mortgageLiability(mortgage: Mortgage, payments: MortgagePayment[]): number {
  return mortgageBalance(mortgage, payments) + mortgageFixedTermInterest(mortgage, payments);
}

/** Sum current value across all non-archived properties. */
export function totalPropertyValue(properties: Property[], asOfIso = currentIsoDate()): number {
  return properties
    .filter(property => isPropertyCurrentAsOf(property, asOfIso))
    .reduce((s, p) => s + p.currentValue, 0);
}

/** Sum total liabilities (principal + fixed-term interest) across all non-archived mortgages. */
export function totalMortgageLiabilities(
  mortgages: Mortgage[],
  payments:  MortgagePayment[],
  asOfIso = currentIsoDate(),
): number {
  return mortgages
    .filter(mortgage => isMortgageCurrentAsOf(mortgage, asOfIso))
    .reduce((s, m) => s + mortgageLiability(m, payments), 0);
}

/** Sum current balances across all non-archived savings accounts. */
export function totalSavingsBalance(accounts: SavingsAccount[]): number {
  return accounts
    .filter(a => !a.archived)
    .reduce((s, a) => s + a.currentBalance, 0);
}

/** Sum current balances across all non-archived debts. */
export function totalDebtBalance(debts: Debt[]): number {
  return debts
    .filter(d => !d.archived)
    .reduce((s, d) => s + d.currentBalance, 0);
}

/** Sum current balances across all non-archived pensions. */
export function totalPensionBalance(pensions: Pension[]): number {
  return pensions
    .filter(p => !p.archived)
    .reduce((s, p) => s + p.currentBalance, 0);
}

// ─── React hook ──────────────────────────────────────────────────────────────

/** Reactive wealth snapshot — re-calculates whenever any store value changes. */
export function useWealthCalc(): WealthCalc {
  const store = useStore();
  return calcWealth(
    store.properties,
    store.mortgages,
    store.mortgagePayments,
    store.savingsAccounts,
    store.debts,
    store.pensions,
  );
}

// ─── Composite calculation ────────────────────────────────────────────────────

/**
 * Full wealth snapshot.
 * Assets  = properties (currentValue) + savings (currentBalance) + pensions (currentBalance)
 * Liabilities = mortgages (amountBorrowed − payments) + debts (currentBalance)
 * Net Worth = Assets − Liabilities
 */
export function calcWealth(
  properties:       Property[],
  mortgages:        Mortgage[],
  mortgagePayments: MortgagePayment[],
  savingsAccounts:  SavingsAccount[],
  debts:            Debt[],
  pensions:         Pension[],
  asOfIso = currentIsoDate(),
): WealthCalc {
  const propertyAssets      = totalPropertyValue(properties, asOfIso);
  const savingsAssets        = totalSavingsBalance(savingsAccounts);
  const pensionAssets        = totalPensionBalance(pensions);
  const mortgageLiabilities  = totalMortgageLiabilities(mortgages, mortgagePayments, asOfIso);
  const debtLiabilities      = totalDebtBalance(debts);

  const totalAssets      = propertyAssets + savingsAssets + pensionAssets;
  const totalLiabilities = mortgageLiabilities + debtLiabilities;

  return {
    propertyAssets,
    savingsAssets,
    pensionAssets,
    totalAssets,
    mortgageLiabilities,
    debtLiabilities,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
