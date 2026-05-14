import type { SubscriptionCurrency } from './types';

export const SUBSCRIPTION_CURRENCIES: SubscriptionCurrency[] = ['GBP', 'USD', 'EUR'];

export type SubscriptionFxRates = Partial<Record<Exclude<SubscriptionCurrency, 'GBP'>, number>>;

export function subscriptionCurrencyLocale(currency: SubscriptionCurrency): string {
  if (currency === 'USD') return 'en-US';
  if (currency === 'EUR') return 'de-DE';
  return 'en-GB';
}

export function formatSubscriptionCurrency(value: number, currency: SubscriptionCurrency): string {
  return new Intl.NumberFormat(subscriptionCurrencyLocale(currency), {
    style: 'currency',
    currency,
  }).format(value);
}

export function subscriptionAmountToGbp(
  value: number,
  currency: SubscriptionCurrency,
  fxRates: SubscriptionFxRates,
): number | null {
  if (currency === 'GBP') return value;
  const rate = fxRates[currency];
  return rate === undefined ? null : value * rate;
}

export function currenciesRequiringFx(currencies: SubscriptionCurrency[]): Array<Exclude<SubscriptionCurrency, 'GBP'>> {
  return [...new Set(currencies.filter((currency): currency is Exclude<SubscriptionCurrency, 'GBP'> => currency !== 'GBP'))];
}

export function exchangeRatePath(currency: Exclude<SubscriptionCurrency, 'GBP'>): string {
  return `/api/exchange-rates/${currency.toLowerCase()}-gbp`;
}
