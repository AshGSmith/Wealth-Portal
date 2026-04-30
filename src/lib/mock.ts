import type {
  Budget,
  Debt,
  DebtHistory,
  DebtTransaction,
  Expense,
  IncomeEntry,
  IncomeSource,
  InvestmentHolding,
  InvestmentPurchase,
  InvestmentValuationHistory,
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
} from './types';
import type { LocalBudget } from './budgetLogic';

export const MOCK_BUDGET: Budget = {
  id: 'budget-empty' as Budget['id'],
  month: '',
  archived: false,
};

export const MOCK_INCOME_SOURCES: IncomeSource[] = [];
export const MOCK_SALARY_HISTORY: SalaryHistory[] = [];
export const MOCK_INCOME_ENTRIES: IncomeEntry[] = [];
export const MOCK_POTS: Pot[] = [];
export const MOCK_EXPENSES: Expense[] = [];
export const MOCK_SAVINGS: Saving[] = [];
export const MOCK_BUDGETS: LocalBudget[] = [];
export const MOCK_MORTGAGES: Mortgage[] = [];
export const MOCK_MORTGAGE_PAYMENTS: MortgagePayment[] = [];
export const MOCK_PROPERTIES: Property[] = [];
export const MOCK_SAVINGS_ACCOUNTS: SavingsAccount[] = [];
export const MOCK_SAVINGS_HISTORY: SavingsHistory[] = [];
export const MOCK_DEBTS: Debt[] = [];
export const MOCK_DEBT_TRANSACTIONS: DebtTransaction[] = [];
export const MOCK_DEBT_HISTORY: DebtHistory[] = [];
export const MOCK_PENSIONS: Pension[] = [];
export const MOCK_PENSION_HISTORY: PensionHistory[] = [];
export const MOCK_INVESTMENTS: InvestmentHolding[] = [];
export const MOCK_INVESTMENT_PURCHASES: InvestmentPurchase[] = [];
export const MOCK_INVESTMENT_VALUATION_HISTORY: InvestmentValuationHistory[] = [];
