import type { IncomeSource, SalaryHistory } from './types';

export function isSalarySource(source: IncomeSource): boolean {
  return source.type === 'salary';
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
