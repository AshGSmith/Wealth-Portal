'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  InvestmentHolding,
  InvestmentPurchase,
  InvestmentValuationHistory,
} from './types';

export type InvestmentMarketQuote = {
  symbol: string;
  price: number;
  currency: string;
  priceGbp: number;
  asOf: string;
  source: string;
  displayName: string | null;
  exchange: string | null;
  sourceId: string | null;
  exchangeRateToGbp: number;
  exchangeRateDate: string;
};

export type InvestmentMarketQuoteMap = Record<string, InvestmentMarketQuote | null>;
export type InvestmentMarketQuoteError = {
  symbol: string;
  code: 'missing_symbol' | 'missing_api_key' | 'provider_error' | 'ticker_not_found' | 'rate_limited' | 'network_error' | 'unsupported_currency' | 'exchange_rate_error';
  message: string;
  provider?: string;
  httpStatus?: number;
  reason?: string;
  requestedSymbol?: string;
};
export type InvestmentMarketQuoteErrorMap = Record<string, InvestmentMarketQuoteError | null>;

export type InvestmentDropAlert = {
  investmentId: string;
  name: string;
  currentValue: number;
  previousValue: number;
  dropAmount: number;
  dropPct: number;
  source: 'market-vs-manual' | 'manual-vs-manual';
};

export type InvestmentValueTrendPoint = {
  month: string;
  label: string;
  investedTotal: number;
  valueTotal: number;
  trendValue: number;
};

type ResolvedInvestmentValue = {
  totalInvested: number;
  totalSharesHeld: number | null;
  latestManualValue: number | null;
  currentValue: number;
  source: 'market' | 'manual' | 'cost';
  marketQuote: InvestmentMarketQuote | null;
};

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const quoteCache = new Map<string, { fetchedAt: number; quote: InvestmentMarketQuote | null; error: InvestmentMarketQuoteError | null }>();

function normalizeQuoteSymbolValue(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized && !/\s/.test(normalized) ? normalized : '';
}

export function quoteSymbolForInstrument(investment: InvestmentHolding): string {
  if (!investment.selectedInstrument) return '';

  return [
    investment.selectedInstrument.symbol,
    investment.selectedInstrument.ticker,
    investment.selectedInstrument.providerSymbol,
    investment.selectedInstrument.yahooSymbol,
    investment.quoteSymbol,
    investment.selectedInstrument.quoteSymbol,
    investment.selectedInstrument.sourceId,
  ]
    .map(normalizeQuoteSymbolValue)
    .find(Boolean) ?? '';
}

export function investmentSelectedInstrumentSymbol(investment: InvestmentHolding): string {
  return quoteSymbolForInstrument(investment);
}

export function investmentSelectedInstrumentDisplayName(investment: InvestmentHolding): string {
  return investment.selectedInstrument?.displayName?.trim()
    || investment.name
    || investmentSelectedInstrumentSymbol(investment)
    || 'Manual investment';
}

function investmentQuoteLookupMeta(investment: InvestmentHolding) {
  const symbol = quoteSymbolForInstrument(investment);
  return {
    symbol,
    displayName: investment.selectedInstrument?.displayName?.trim() || null,
    exchange: investment.selectedInstrument?.exchange?.trim() || null,
    currencyHint: investment.selectedInstrument?.currency?.trim().toUpperCase() || null,
    source: investment.selectedInstrument?.source?.trim() || null,
    sourceId: symbol,
  };
}

function monthStartFromDate(date: string): string {
  return date.slice(0, 7);
}

function monthEndFromYearMonth(month: string): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  const date = new Date(yearPart, monthPart, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftMonth(month: string, offset: number): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  const date = new Date(yearPart, monthPart - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  return new Date(yearPart, monthPart - 1, 1).toLocaleString('en-GB', { month: 'short', year: '2-digit' });
}

function movingAverage(values: number[], index: number, radius = 1): number {
  const start = Math.max(0, index - radius);
  const end = Math.min(values.length - 1, index + radius);
  const window = values.slice(start, end + 1);
  return window.reduce((sum, value) => sum + value, 0) / window.length;
}

export function totalInvestedForInvestment(investmentId: string, purchases: InvestmentPurchase[]): number {
  return purchases
    .filter(entry => entry.investmentId === investmentId)
    .reduce((sum, entry) => sum + entry.amountInvested, 0);
}

export function totalSharesHeldForInvestment(
  investmentId: string,
  purchases: InvestmentPurchase[],
  throughDate?: string,
): number | null {
  const matching = purchases.filter(
    entry => entry.investmentId === investmentId && (!throughDate || entry.purchaseDate <= throughDate),
  );
  if (matching.length === 0) return null;
  if (matching.some(entry => entry.sharesPurchased === null)) return null;

  const totalShares = matching.reduce((sum, entry) => sum + (entry.sharesPurchased ?? 0), 0);
  return totalShares > 0 ? totalShares : null;
}

export function latestManualValuationForInvestment(
  investmentId: string,
  valuations: InvestmentValuationHistory[],
): InvestmentValuationHistory | null {
  return valuations
    .filter(entry => entry.investmentId === investmentId)
    .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate))[0] ?? null;
}

export function resolveInvestmentCurrentValue(
  investment: InvestmentHolding,
  purchases: InvestmentPurchase[],
  valuations: InvestmentValuationHistory[],
  marketQuotes?: InvestmentMarketQuoteMap,
): ResolvedInvestmentValue {
  const totalInvested = totalInvestedForInvestment(investment.id, purchases);
  const totalSharesHeld = totalSharesHeldForInvestment(investment.id, purchases);
  const latestManualValuation = latestManualValuationForInvestment(investment.id, valuations);
  const symbolKey = investmentSelectedInstrumentSymbol(investment);
  const marketQuote = symbolKey ? marketQuotes?.[symbolKey] ?? null : null;

  if (marketQuote && totalSharesHeld !== null) {
    return {
      totalInvested,
      totalSharesHeld,
      latestManualValue: latestManualValuation?.currentValue ?? null,
      currentValue: marketQuote.priceGbp * totalSharesHeld,
      source: 'market',
      marketQuote,
    };
  }

  if (latestManualValuation) {
    return {
      totalInvested,
      totalSharesHeld,
      latestManualValue: latestManualValuation.currentValue,
      currentValue: latestManualValuation.currentValue,
      source: 'manual',
      marketQuote,
    };
  }

  return {
    totalInvested,
    totalSharesHeld,
    latestManualValue: null,
    currentValue: totalInvested,
    source: 'cost',
    marketQuote,
  };
}

export function dramaticInvestmentDrops(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
  valuations: InvestmentValuationHistory[],
  marketQuotes: InvestmentMarketQuoteMap,
  thresholdPct = 0.15,
): InvestmentDropAlert[] {
  return investments
    .filter(investment => !investment.archived)
    .flatMap(investment => {
      const investmentPurchases = purchases.filter(entry => entry.investmentId === investment.id);
      const investmentValuations = valuations
        .filter(entry => entry.investmentId === investment.id)
        .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate));
      const resolved = resolveInvestmentCurrentValue(investment, investmentPurchases, investmentValuations, marketQuotes);

      let previousValue: number | null = null;
      let source: InvestmentDropAlert['source'] | null = null;

      if (resolved.source === 'market') {
        previousValue = investmentValuations[0]?.currentValue ?? null;
        source = previousValue !== null ? 'market-vs-manual' : null;
      } else if (resolved.source === 'manual') {
        previousValue = investmentValuations[1]?.currentValue ?? null;
        source = previousValue !== null ? 'manual-vs-manual' : null;
      }

      if (previousValue === null || previousValue <= 0 || source === null) {
        return [];
      }

      const dropAmount = previousValue - resolved.currentValue;
      const dropPct = dropAmount / previousValue;

      if (dropAmount <= 0 || dropPct < thresholdPct) {
        return [];
      }

      return [{
        investmentId: investment.id as string,
        name: investment.name,
        currentValue: resolved.currentValue,
        previousValue,
        dropAmount,
        dropPct,
        source,
      }];
    })
    .sort((a, b) => b.dropPct - a.dropPct);
}

export function combinedInvestmentValueTrend(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
  valuations: InvestmentValuationHistory[],
  marketQuotes: InvestmentMarketQuoteMap,
  asOfDate = new Date().toISOString().slice(0, 10),
): InvestmentValueTrendPoint[] {
  const activeInvestments = investments.filter(investment => !investment.archived);
  const activePurchases = purchases
    .filter(entry => activeInvestments.some(investment => investment.id === entry.investmentId))
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));

  if (activePurchases.length === 0) {
    return [];
  }

  const startMonth = monthStartFromDate(activePurchases[0].purchaseDate);
  const endMonth = monthStartFromDate(asOfDate);
  const months: string[] = [];

  for (let month = startMonth; month <= endMonth; month = shiftMonth(month, 1)) {
    months.push(month);
  }

  const points = months.map(month => {
    const monthEnd = monthEndFromYearMonth(month);
    const isCurrentMonth = month === endMonth;

    const investedTotal = activePurchases
      .filter(entry => entry.purchaseDate <= monthEnd)
      .reduce((sum, entry) => sum + entry.amountInvested, 0);

    const valueTotal = activeInvestments.reduce((sum, investment) => {
      const investmentPurchases = activePurchases.filter(
        entry => entry.investmentId === investment.id && entry.purchaseDate <= monthEnd,
      );

      if (investmentPurchases.length === 0) {
        return sum;
      }

      const investmentValuations = valuations
        .filter(entry => entry.investmentId === investment.id && entry.valuationDate <= monthEnd)
        .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate));

      const investedValue = investmentPurchases.reduce((total, entry) => total + entry.amountInvested, 0);

      if (isCurrentMonth) {
        const symbolKey = investmentSelectedInstrumentSymbol(investment);
        const marketQuote = symbolKey ? marketQuotes[symbolKey] ?? null : null;
        const sharesHeld = totalSharesHeldForInvestment(investment.id, activePurchases, monthEnd);
        if (marketQuote && sharesHeld !== null) {
          return sum + (marketQuote.priceGbp * sharesHeld);
        }
      }

      const latestValuation = investmentValuations[0];
      return sum + (latestValuation?.currentValue ?? investedValue);
    }, 0);

    return {
      month,
      label: monthLabel(month),
      investedTotal,
      valueTotal,
      trendValue: valueTotal,
    };
  });

  const values = points.map(point => point.valueTotal);
  return points.map((point, index) => ({
    ...point,
    trendValue: movingAverage(values, index, 1),
  }));
}

function fmtUsdCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function purchasePerShareSummary(entry: InvestmentPurchase): string | null {
  if (entry.perSharePriceGbp === null) return null;

  const gbpPart = `${new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(entry.perSharePriceGbp)}/share`;

  if (entry.perShareCurrency === 'USD' && entry.perSharePrice !== null) {
    return `${gbpPart} (${fmtUsdCurrency(entry.perSharePrice)}/share)`;
  }

  return gbpPart;
}

export function purchaseExchangeRateNote(entry: InvestmentPurchase): string | null {
  if (entry.perShareCurrency !== 'USD' || entry.exchangeRateToGbp === null) return null;
  return `USD→GBP ${entry.exchangeRateToGbp.toFixed(4)}${entry.exchangeRateDate ? ` on ${entry.exchangeRateDate}` : ''}`;
}

async function fetchMarketQuote(
  investment: InvestmentHolding,
): Promise<{ quote: InvestmentMarketQuote | null; error: InvestmentMarketQuoteError | null }> {
  const lookup = investmentQuoteLookupMeta(investment);
  const symbol = lookup.symbol;
  const cached = quoteCache.get(symbol);
  if (cached && (Date.now() - cached.fetchedAt) < QUOTE_CACHE_TTL_MS) {
    return { quote: cached.quote, error: cached.error };
  }

  try {
    const params = new URLSearchParams({ symbol });
    if (lookup.displayName) params.set('displayName', lookup.displayName);
    if (lookup.exchange) params.set('exchange', lookup.exchange);
    if (lookup.currencyHint) params.set('currencyHint', lookup.currencyHint);
    if (lookup.source) params.set('source', lookup.source);
    if (lookup.sourceId) params.set('sourceId', lookup.sourceId);

    const response = await fetch(`/api/market-data/investment-quote?${params.toString()}`, {
      cache: 'no-store',
    });

    const payload = await response.json() as InvestmentMarketQuote | InvestmentMarketQuoteError | { message?: string };

    if (response.ok && 'price' in payload) {
      quoteCache.set(symbol, { fetchedAt: Date.now(), quote: payload, error: null });
      return { quote: payload, error: null };
    }

    const error = {
      symbol,
      code: 'code' in payload ? payload.code : 'provider_error',
      message: 'message' in payload && payload.message ? payload.message : 'Failed to load live market quote.',
      provider: 'provider' in payload ? payload.provider : undefined,
      httpStatus: 'httpStatus' in payload ? payload.httpStatus : response.status,
      reason: 'reason' in payload ? payload.reason : undefined,
      requestedSymbol: 'requestedSymbol' in payload ? payload.requestedSymbol : symbol,
    } satisfies InvestmentMarketQuoteError;
    quoteCache.set(symbol, { fetchedAt: Date.now(), quote: null, error });
    return { quote: null, error };
  } catch {
    const error = {
      symbol,
      code: 'network_error',
      message: 'Failed to load live market quote due to a network error.',
    } satisfies InvestmentMarketQuoteError;
    quoteCache.set(symbol, { fetchedAt: Date.now(), quote: null, error });
    return { quote: null, error };
  }
}

export function useInvestmentMarketData(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
): { quotes: InvestmentMarketQuoteMap; errors: InvestmentMarketQuoteErrorMap } {
  const [quotes, setQuotes] = useState<InvestmentMarketQuoteMap>({});
  const [errors, setErrors] = useState<InvestmentMarketQuoteErrorMap>({});

  const eligibleLookups = useMemo(() => {
    return Object.values(
      investments
        .filter(investment => !investment.archived)
        .filter(investment => investmentSelectedInstrumentSymbol(investment).length > 0)
        .filter(investment => totalSharesHeldForInvestment(investment.id, purchases) !== null)
        .reduce<Record<string, InvestmentHolding>>((acc, investment) => {
          acc[investmentSelectedInstrumentSymbol(investment)] = investment;
          return acc;
        }, {}),
    ).sort((a, b) => investmentSelectedInstrumentSymbol(a).localeCompare(investmentSelectedInstrumentSymbol(b)));
  }, [investments, purchases]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuotes() {
      const nextEntries = await Promise.all(
        eligibleLookups.map(async investment => [investmentSelectedInstrumentSymbol(investment), await fetchMarketQuote(investment)] as const),
      );

      if (cancelled) return;

      setQuotes(prev => {
        const next: InvestmentMarketQuoteMap = { ...prev };
        for (const [symbol, result] of nextEntries) {
          next[symbol] = result.quote;
        }
        return next;
      });

      setErrors(prev => {
        const next: InvestmentMarketQuoteErrorMap = { ...prev };
        for (const [symbol, result] of nextEntries) {
          next[symbol] = result.error;
        }
        return next;
      });
    }

    if (eligibleLookups.length > 0) {
      void loadQuotes();
    }

    return () => {
      cancelled = true;
    };
  }, [eligibleLookups]);

  return { quotes, errors };
}

export function useInvestmentMarketQuotes(
  investments: InvestmentHolding[],
  purchases: InvestmentPurchase[],
): InvestmentMarketQuoteMap {
  return useInvestmentMarketData(investments, purchases).quotes;
}

export function marketQuotePriceSummary(quote: InvestmentMarketQuote): string {
  const gbpPart = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(quote.priceGbp);

  if (quote.currency === 'USD') {
    return `${fmtUsdCurrency(quote.price)}/share (${gbpPart}/share)`;
  }

  return `${gbpPart}/share`;
}
