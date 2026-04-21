import type { IncomeEntry, IncomeSource, SalaryHistory } from './types';

function toYearMonth(date: string): string {
  return date.slice(0, 7);
}

function previousYearMonth(month: string): string {
  const [year, currentMonth] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, currentMonth - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function isSalarySource(source: IncomeSource): boolean {
  return source.type === 'salary';
}

export function isExpenseReimbursementSource(source: IncomeSource): boolean {
  return source.type === 'expense-reimbursement';
}

export function salaryHistoryForSource(
  sourceId: string,
  history: SalaryHistory[],
): SalaryHistory[] {
  return history
    .filter(entry => entry.incomeSourceId === sourceId)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
}

export function latestAnnualSalary(
  source: IncomeSource,
  history: SalaryHistory[],
): number | null {
  const latest = salaryHistoryForSource(source.id, history)[0] ?? null;
  return latest?.annualSalary ?? source.startingAnnualSalary ?? null;
}

export function sortIncomeEntriesByStartDateDesc(entries: IncomeEntry[]): IncomeEntry[] {
  return [...entries].sort((a, b) => {
    const startCompare = b.date.localeCompare(a.date);
    if (startCompare !== 0) return startCompare;
    return (b.endDate ?? '').localeCompare(a.endDate ?? '');
  });
}

export function incomeEntryAppliesToBudgetMonth(
  entry: IncomeEntry,
  source: IncomeSource,
  month: string,
): boolean {
  if (isExpenseReimbursementSource(source)) {
    return previousYearMonth(toYearMonth(entry.date)) === month;
  }

  if (toYearMonth(entry.date) > month) return false;
  if (entry.endDate && toYearMonth(entry.endDate) <= month) return false;
  return true;
}

export function incomeForSourceInBudgetMonth(
  source: IncomeSource,
  entries: IncomeEntry[],
  month: string,
): number {
  return entries
    .filter(entry => entry.incomeSourceId === source.id && incomeEntryAppliesToBudgetMonth(entry, source, month))
    .reduce((sum, entry) => sum + entry.amount, 0);
}
