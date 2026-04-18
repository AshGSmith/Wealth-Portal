export { fmtCurrency } from './constants';
import { INCOME_SOURCE_LABELS } from './constants';

export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function fmtSourceType(type: string): string {
  return INCOME_SOURCE_LABELS[type as keyof typeof INCOME_SOURCE_LABELS] ?? type;
}
