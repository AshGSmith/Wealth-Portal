// ─── Income source types ─────────────────────────────────────────────────────

export const INCOME_SOURCE_TYPES = ['salary', 'business', 'expense-reimbursement', 'other'] as const;
export type IncomeSourceType = typeof INCOME_SOURCE_TYPES[number];

export const INCOME_SOURCE_LABELS: Record<IncomeSourceType, string> = {
  'salary':                'Salary',
  'business':              'Business',
  'expense-reimbursement': 'Expense Reimbursement',
  'other':                 'Other',
};

export const INCOME_SOURCE_COLOURS: Record<IncomeSourceType, string> = {
  'salary':                '#3b82f6',
  'business':              '#10b981',
  'expense-reimbursement': '#f59e0b',
  'other':                 '#a855f7',
};

// ─── Currency formatter ───────────────────────────────────────────────────────

const _currencyFmt = new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** Formats a number as GBP currency: £1,234.56 */
export function fmtCurrency(n: number): string {
  return _currencyFmt.format(n);
}
