import { useStore } from './store';
import { resolveInvestmentCurrentValue, useInvestmentMarketQuotes, type InvestmentMarketQuoteMap } from './investmentCalc';
import type {
  Property, Mortgage, MortgagePayment,
  SavingsAccount, SavingsHistory,
  Debt, DebtHistory,
  Pension, PensionHistory, PensionPayment,
  InvestmentHolding, InvestmentPurchase, InvestmentValuationHistory,
} from './types';

// ─── Output types ─────────────────────────────────────────────────────────────

export interface WealthCalc {
  // Asset components
  propertyAssets:  number;
  savingsAssets:   number;
  pensionAssets:   number;
  investmentAssets: number;
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

export interface WealthCalcInput {
  properties: Property[];
  mortgages: Mortgage[];
  mortgagePayments: MortgagePayment[];
  savingsAccounts: SavingsAccount[];
  savingsHistory?: SavingsHistory[];
  debts: Debt[];
  debtHistory?: DebtHistory[];
  pensions: Pension[];
  pensionHistory?: PensionHistory[];
  investments: InvestmentHolding[];
  investmentPurchases: InvestmentPurchase[];
  investmentValuationHistory: InvestmentValuationHistory[];
}

function currentIsoDate(): string {
  return isoDateFromLocalDate(new Date());
}

function currentYearMonth(): string {
  return currentIsoDate().slice(0, 7);
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

function monthEnd(month: string): string {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const date = new Date(year, monthIndex + 1, 0);
  return isoDateFromLocalDate(date);
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

export function totalPensionContributionsForPension(
  pensionId: string,
  payments: PensionPayment[],
): number {
  return payments
    .filter(payment => payment.pensionId === pensionId)
    .reduce((sum, payment) => sum + payment.employeeContribution + payment.employerContribution, 0);
}

export function pensionReturnFromInitialInvestment(pension: Pension): number | null {
  if (pension.initialInvestment === null) return null;
  return pension.currentBalance - pension.initialInvestment;
}

/** Sum latest valuation across all non-archived investment holdings. */
export function totalInvestmentValue(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
  valuationHistory: InvestmentValuationHistory[],
  marketQuotes?: InvestmentMarketQuoteMap,
): number {
  return investments
    .filter(investment => !investment.archived)
    .reduce((sum, investment) => (
      sum + resolveInvestmentCurrentValue(investment, purchases, valuationHistory, marketQuotes).currentValue
    ), 0);
}

function snapshotBalanceForMonth<T extends { id: string; archived: boolean; currentBalance: number }, H extends { date: string; balance: number }>(
  records: T[],
  history: H[],
  getHistoryRecordId: (entry: H) => string,
  month: string,
): number {
  const isCurrentOrFutureMonth = month >= currentYearMonth();

  return records
    .filter(record => !record.archived)
    .reduce((sum, record) => {
      const latestSnapshot = history
        .filter(entry => getHistoryRecordId(entry) === record.id && entry.date.slice(0, 7) <= month)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1);

      if (latestSnapshot) return sum + latestSnapshot.balance;
      return sum + (isCurrentOrFutureMonth ? record.currentBalance : 0);
    }, 0);
}

function totalMortgageLiabilitiesForMonth(
  mortgages: Mortgage[],
  payments: MortgagePayment[],
  month: string,
): number {
  const asOfIso = monthEnd(month);

  return mortgages
    .filter(mortgage => isMortgageCurrentAsOf(mortgage, asOfIso))
    .reduce((sum, mortgage) => {
      const paymentsToMonth = payments.filter(payment => payment.mortgageId === mortgage.id && payment.date <= asOfIso);
      return sum + mortgageLiability(mortgage, paymentsToMonth);
    }, 0);
}

function totalInvestmentValueForMonth(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
  valuationHistory: InvestmentValuationHistory[],
  month: string,
  marketQuotes?: InvestmentMarketQuoteMap,
): number {
  if (month >= currentYearMonth()) {
    return totalInvestmentValue(investments, purchases, valuationHistory, marketQuotes);
  }

  const asOfIso = monthEnd(month);
  const purchasesToMonth = purchases.filter(purchase => purchase.purchaseDate <= asOfIso);
  const valuationHistoryToMonth = valuationHistory.filter(valuation => valuation.valuationDate <= asOfIso);
  return totalInvestmentValue(investments, purchasesToMonth, valuationHistoryToMonth);
}

// ─── React hook ──────────────────────────────────────────────────────────────

/** Reactive wealth snapshot — re-calculates whenever any store value changes. */
export function useWealthCalc(): WealthCalc {
  const store = useStore();
  const marketQuotes = useInvestmentMarketQuotes(store.investments, store.investmentPurchases);
  return calcCurrentWealth(
    {
      properties: store.properties,
      mortgages: store.mortgages,
      mortgagePayments: store.mortgagePayments,
      savingsAccounts: store.savingsAccounts,
      debts: store.debts,
      pensions: store.pensions,
      investments: store.investments,
      investmentPurchases: store.investmentPurchases,
      investmentValuationHistory: store.investmentValuationHistory,
    },
    marketQuotes,
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
  investments:      InvestmentHolding[],
  investmentPurchases: InvestmentPurchase[],
  investmentValuationHistory: InvestmentValuationHistory[],
  marketQuotes?: InvestmentMarketQuoteMap,
  asOfIso = currentIsoDate(),
): WealthCalc {
  const propertyAssets      = totalPropertyValue(properties, asOfIso);
  const savingsAssets        = totalSavingsBalance(savingsAccounts);
  const pensionAssets        = totalPensionBalance(pensions);
  const investmentAssets     = totalInvestmentValue(investments, investmentPurchases, investmentValuationHistory, marketQuotes);
  const mortgageLiabilities  = totalMortgageLiabilities(mortgages, mortgagePayments, asOfIso);
  const debtLiabilities      = totalDebtBalance(debts);

  const totalAssets      = propertyAssets + savingsAssets + pensionAssets + investmentAssets;
  const totalLiabilities = mortgageLiabilities + debtLiabilities;

  return {
    propertyAssets,
    savingsAssets,
    pensionAssets,
    investmentAssets,
    totalAssets,
    mortgageLiabilities,
    debtLiabilities,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}

export function calcCurrentWealth(
  input: WealthCalcInput,
  marketQuotes?: InvestmentMarketQuoteMap,
  asOfIso = currentIsoDate(),
): WealthCalc {
  return calcWealth(
    input.properties,
    input.mortgages,
    input.mortgagePayments,
    input.savingsAccounts,
    input.debts,
    input.pensions,
    input.investments,
    input.investmentPurchases,
    input.investmentValuationHistory,
    marketQuotes,
    asOfIso,
  );
}

export function calcWealthForMonth(
  input: WealthCalcInput,
  month: string,
  marketQuotes?: InvestmentMarketQuoteMap,
): WealthCalc {
  if (month === currentYearMonth()) {
    return calcCurrentWealth(input, marketQuotes);
  }

  const asOfIso = monthEnd(month);
  const propertyAssets = totalPropertyValue(input.properties, asOfIso);
  const savingsAssets = snapshotBalanceForMonth(
    input.savingsAccounts,
    input.savingsHistory ?? [],
    entry => entry.savingsAccountId as string,
    month,
  );
  const pensionAssets = snapshotBalanceForMonth(
    input.pensions,
    input.pensionHistory ?? [],
    entry => entry.pensionId as string,
    month,
  );
  const investmentAssets = totalInvestmentValueForMonth(
    input.investments,
    input.investmentPurchases,
    input.investmentValuationHistory,
    month,
    marketQuotes,
  );
  const mortgageLiabilities = totalMortgageLiabilitiesForMonth(input.mortgages, input.mortgagePayments, month);
  const debtLiabilities = snapshotBalanceForMonth(
    input.debts,
    input.debtHistory ?? [],
    entry => entry.debtId as string,
    month,
  );
  const totalAssets = propertyAssets + savingsAssets + pensionAssets + investmentAssets;
  const totalLiabilities = mortgageLiabilities + debtLiabilities;

  return {
    propertyAssets,
    savingsAssets,
    pensionAssets,
    investmentAssets,
    totalAssets,
    mortgageLiabilities,
    debtLiabilities,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
