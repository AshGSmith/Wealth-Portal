import { NextRequest, NextResponse } from 'next/server';

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; payload: unknown }>();

type QuotePayload = {
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

type QuoteErrorPayload = {
  symbol: string;
  code: 'missing_symbol' | 'missing_api_key' | 'provider_error' | 'ticker_not_found' | 'rate_limited' | 'network_error' | 'unsupported_currency' | 'exchange_rate_error';
  message: string;
  provider?: string;
  httpStatus?: number;
  reason?: string;
  requestedSymbol?: string;
};

async function fetchUsdToGbpRate() {
  const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to load USD to GBP exchange rate.');
  const data = await response.json() as
    | { date?: string; rates?: Record<string, number> }
    | Array<{ date?: string; quote?: string; rate?: number }>;
  const latest = Array.isArray(data)
    ? data.find(entry => entry.quote?.toUpperCase() === 'GBP' && Number.isFinite(entry.rate))
    : null;
  const rate = Array.isArray(data) ? latest?.rate ?? null : data.rates?.GBP ?? null;
  const date = Array.isArray(data) ? latest?.date ?? null : data.date ?? null;
  if (!rate || !date) throw new Error('USD to GBP exchange rate unavailable.');
  return { rate, date };
}

function errorResponse(
  symbol: string,
  code: QuoteErrorPayload['code'],
  message: string,
  status: number,
  provider?: string,
  reason?: string,
) {
  return NextResponse.json({ symbol, code, message, provider, httpStatus: status, reason, requestedSymbol: symbol } satisfies QuoteErrorPayload, { status });
}

function inferCurrencyFromSymbol(symbol: string): 'USD' | 'GBP' | null {
  if (symbol.endsWith('.L')) return 'GBP';
  if (symbol.endsWith('.LON')) return 'GBP';
  if (/^[A-Z-]+$/.test(symbol)) return 'USD';
  return null;
}

async function fetchOverviewCurrency(symbol: string, apiKey: string): Promise<string | null> {
  const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const response = await fetch(overviewUrl, { cache: 'no-store' });
  if (!response.ok) return null;

  const data = await response.json() as Record<string, string>;
  const currency = (data.Currency ?? '').toUpperCase();
  return currency || null;
}

function normalizeQuotePayload(
  symbol: string,
  price: number,
  currency: string,
  asOf: string,
  source: string,
  displayName: string | null,
  exchange: string | null,
  sourceId: string | null,
  exchangeRateToGbp: number,
  exchangeRateDate: string,
): QuotePayload {
  return {
    symbol,
    price,
    currency,
    priceGbp: price * exchangeRateToGbp,
    asOf,
    source,
    displayName,
    exchange,
    sourceId,
    exchangeRateToGbp,
    exchangeRateDate,
  };
}

type QuoteRequestMeta = {
  symbol: string;
  displayName: string | null;
  exchange: string | null;
  currencyHint: string | null;
  source: string | null;
  sourceId: string | null;
};

type QuoteProviderResult =
  | { ok: true; payload: Omit<QuotePayload, 'priceGbp' | 'exchangeRateToGbp' | 'exchangeRateDate'> }
  | { ok: false; code: QuoteErrorPayload['code']; message: string; provider: string; httpStatus?: number; reason?: string; requestedSymbol: string };

async function fetchYahooChartQuote(
  meta: QuoteRequestMeta,
  priorReason?: string,
): Promise<QuoteProviderResult> {
  const provider = 'Yahoo Finance';
  const requestSymbol = meta.symbol.trim().toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(requestSymbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 Wealth-Management-Portal/0.1',
      },
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => '');
      return {
        ok: false,
        code: 'provider_error',
        message: `Yahoo Finance did not return a chart quote for ${requestSymbol} (HTTP ${response.status}).`,
        provider,
        httpStatus: response.status,
        reason: [priorReason, reason.slice(0, 500) || response.statusText].filter(Boolean).join(' | ') || undefined,
        requestedSymbol: requestSymbol,
      };
    }

    const data = await response.json() as {
      chart?: {
        error?: { code?: string; description?: string } | null;
        result?: Array<{
          meta?: {
            currency?: string;
            symbol?: string;
            exchangeName?: string;
            fullExchangeName?: string;
            regularMarketPrice?: number;
            regularMarketTime?: number;
            longName?: string;
            shortName?: string;
          };
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: Array<number | null> }>;
            adjclose?: Array<{ adjclose?: Array<number | null> }>;
          };
        }>;
      };
    };

    const providerError = data.chart?.error;
    if (providerError) {
      return {
        ok: false,
        code: 'provider_error',
        message: `Yahoo Finance returned a chart error for ${requestSymbol}.`,
        provider,
        reason: [priorReason, providerError.description || providerError.code].filter(Boolean).join(' | ') || undefined,
        requestedSymbol: requestSymbol,
      };
    }

    const result = data.chart?.result?.[0];
    const metaResult = result?.meta;
    const closePrices = result?.indicators?.quote?.[0]?.close ?? result?.indicators?.adjclose?.[0]?.adjclose ?? [];
    const latestClose = [...closePrices].reverse().find((value): value is number => Number.isFinite(value));
    const latestTimestamp = [...(result?.timestamp ?? [])].reverse().find(value => Number.isFinite(value));
    const price = metaResult?.regularMarketPrice ?? latestClose;
    const currency = metaResult?.currency?.toUpperCase() ?? meta.currencyHint ?? null;
    const marketTime = metaResult?.regularMarketTime ?? latestTimestamp ?? null;

    if (!Number.isFinite(price) || !currency || !marketTime) {
      return {
        ok: false,
        code: 'ticker_not_found',
        message: `Yahoo Finance returned no usable chart quote for ${requestSymbol}.`,
        provider,
        reason: [priorReason, `No chart result with finite price, currency, and market time. Result count: ${data.chart?.result?.length ?? 0}.`].filter(Boolean).join(' | '),
        requestedSymbol: requestSymbol,
      };
    }

    return {
      ok: true,
      payload: {
        symbol: metaResult?.symbol?.toUpperCase() ?? requestSymbol,
        price: Number(price),
        currency,
        asOf: new Date(Number(marketTime) * 1000).toISOString().slice(0, 10),
        source: provider,
        displayName: metaResult?.longName?.trim() || metaResult?.shortName?.trim() || meta.displayName,
        exchange: metaResult?.fullExchangeName?.trim() || metaResult?.exchangeName?.trim() || meta.exchange,
        sourceId: requestSymbol,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'network_error',
      message: `Yahoo Finance chart lookup failed for ${requestSymbol} due to a network error.`,
      provider,
      reason: priorReason,
      requestedSymbol: requestSymbol,
    };
  }
}

async function fetchYahooQuote(meta: QuoteRequestMeta): Promise<
  QuoteProviderResult
> {
  const provider = 'Yahoo Finance';
  const requestSymbol = meta.symbol.trim().toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(requestSymbol)}&formatted=false`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 Wealth-Management-Portal/0.1',
      },
    });

    if (!response.ok) {
      const reason = await response.text().catch(() => '');
      return fetchYahooChartQuote(meta, `Quote endpoint HTTP ${response.status}: ${reason.slice(0, 500) || response.statusText}`);
    }

    const data = await response.json() as {
      quoteResponse?: {
        error?: { code?: string; description?: string } | null;
        result?: Array<{
          symbol?: string;
          shortName?: string;
          longName?: string;
          fullExchangeName?: string;
          exchange?: string;
          currency?: string;
          regularMarketPrice?: number;
          postMarketPrice?: number;
          preMarketPrice?: number;
          regularMarketTime?: number;
          postMarketTime?: number;
          preMarketTime?: number;
        }>;
      };
    };

    const providerError = data.quoteResponse?.error;
    if (providerError) {
      return fetchYahooChartQuote(meta, `Quote endpoint error: ${providerError.description || providerError.code || 'unknown'}`);
    }

    const result = data.quoteResponse?.result?.[0];
    const price = result?.regularMarketPrice ?? result?.postMarketPrice ?? result?.preMarketPrice;
    const currency = result?.currency?.toUpperCase() ?? meta.currencyHint ?? null;
    const resolvedSymbol = result?.symbol?.toUpperCase() ?? requestSymbol;
    const displayName = result?.longName?.trim() || result?.shortName?.trim() || meta.displayName;
    const exchange = result?.fullExchangeName?.trim() || result?.exchange?.trim() || meta.exchange;
    const quoteTime = result?.regularMarketTime ?? result?.postMarketTime ?? result?.preMarketTime;
    const marketTime = quoteTime
      ? new Date(quoteTime * 1000).toISOString().slice(0, 10)
      : null;

    if (!Number.isFinite(price) || !currency || !marketTime) {
      return fetchYahooChartQuote(meta, `Quote endpoint returned no usable quote. Result count: ${data.quoteResponse?.result?.length ?? 0}.`);
    }

    const safePrice = Number(price);

    return {
      ok: true,
      payload: {
        symbol: resolvedSymbol,
        price: safePrice,
        currency,
        asOf: marketTime,
        source: provider,
        displayName,
        exchange,
        sourceId: requestSymbol,
      },
    };
  } catch {
    return { ok: false, code: 'network_error', message: `Yahoo Finance lookup failed for ${requestSymbol} due to a network error.`, provider, requestedSymbol: requestSymbol };
  }
}

async function fetchAlphaVantageQuote(meta: QuoteRequestMeta, apiKey: string): Promise<
  QuoteProviderResult
> {
  const provider = 'Alpha Vantage';
  const symbol = meta.symbol;

  try {
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const quoteResponse = await fetch(quoteUrl, { cache: 'no-store' });

    if (!quoteResponse.ok) {
      return { ok: false, code: 'provider_error', message: `Alpha Vantage did not return a quote for ${symbol} (HTTP ${quoteResponse.status}).`, provider, httpStatus: quoteResponse.status, reason: quoteResponse.statusText || undefined, requestedSymbol: symbol };
    }

    const quoteJson = await quoteResponse.json() as Record<string, string | Record<string, string>>;
    if (typeof quoteJson.Note === 'string' && quoteJson.Note.length > 0) {
      return { ok: false, code: 'rate_limited', message: 'Alpha Vantage rate limit reached.', provider, reason: quoteJson.Note, requestedSymbol: symbol };
    }
    if (typeof quoteJson['Error Message'] === 'string' && quoteJson['Error Message'].length > 0) {
      return { ok: false, code: 'ticker_not_found', message: `Ticker ${symbol} was not found on Alpha Vantage.`, provider, reason: quoteJson['Error Message'], requestedSymbol: symbol };
    }

    const quoteData = quoteJson['Global Quote'] as Record<string, string> | undefined;
    const price = quoteData ? Number(quoteData['05. price']) : NaN;
    const latestTradingDay = quoteData?.['07. latest trading day'] ?? null;
    let currency = inferCurrencyFromSymbol(symbol);

    if (!currency) {
      const overviewCurrency = await fetchOverviewCurrency(symbol, apiKey);
      currency = overviewCurrency === 'USD' || overviewCurrency === 'GBP' ? overviewCurrency : null;
    }

    if (!Number.isFinite(price) || !latestTradingDay) {
      return { ok: false, code: 'ticker_not_found', message: `Ticker ${symbol} was not found on Alpha Vantage.`, provider, reason: 'Global Quote did not include a finite price and latest trading day.', requestedSymbol: symbol };
    }

    if (!currency) {
      return { ok: false, code: 'unsupported_currency', message: `Could not determine quote currency for ${symbol}.`, provider, requestedSymbol: symbol };
    }

    return {
      ok: true,
      payload: {
        symbol,
        price,
        currency,
        asOf: latestTradingDay,
        source: provider,
        displayName: meta.displayName,
        exchange: meta.exchange,
        sourceId: meta.sourceId,
      },
    };
  } catch {
    return { ok: false, code: 'network_error', message: `Alpha Vantage lookup failed for ${symbol} due to a network error.`, provider, requestedSymbol: symbol };
  }
}

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const displayName = request.nextUrl.searchParams.get('displayName')?.trim() || null;
  const exchange = request.nextUrl.searchParams.get('exchange')?.trim() || null;
  const currencyHint = request.nextUrl.searchParams.get('currencyHint')?.trim().toUpperCase() || null;
  const source = request.nextUrl.searchParams.get('source')?.trim() || null;
  const sourceId = request.nextUrl.searchParams.get('sourceId')?.trim() || null;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();

  if (!rawSymbol) {
    return errorResponse(rawSymbol, 'missing_symbol', 'Missing symbol.', 400);
  }

  const cached = cache.get(rawSymbol);
  if (cached && (Date.now() - cached.fetchedAt) < QUOTE_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const meta: QuoteRequestMeta = {
      symbol: rawSymbol,
      displayName,
      exchange,
      currencyHint,
      source,
      sourceId,
    };
    const providerResults: QuoteProviderResult[] = [];

    const yahooResult = await fetchYahooQuote(meta);
    providerResults.push(yahooResult);
    let winningPayload = yahooResult.ok ? yahooResult.payload : null;

    if (!winningPayload && apiKey) {
      const alphaResult = await fetchAlphaVantageQuote(meta, apiKey);
      providerResults.push(alphaResult);
      winningPayload = alphaResult.ok ? alphaResult.payload : null;
    }

    if (!winningPayload) {
      const lastError = [...providerResults].reverse().find(result => !result.ok);
      if (!apiKey && lastError) {
        const payload = {
          symbol: rawSymbol,
          code: lastError.code,
          message: `${lastError.message} Requested quoteSymbol: ${lastError.requestedSymbol}. Provider: ${lastError.provider}. ${lastError.httpStatus ? `HTTP status: ${lastError.httpStatus}. ` : ''}${lastError.reason ? `Reason: ${lastError.reason}. ` : ''}No Alpha Vantage API key is configured for fallback.`,
          provider: lastError.provider,
          httpStatus: lastError.httpStatus,
          reason: lastError.reason,
          requestedSymbol: lastError.requestedSymbol,
        } satisfies QuoteErrorPayload;
        cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
        return NextResponse.json(payload, { status: payload.code === 'ticker_not_found' ? 404 : payload.code === 'rate_limited' ? 429 : 503 });
      }

      const payload = lastError
        ? {
            symbol: rawSymbol,
            code: lastError.code,
            message: `${lastError.message} Requested quoteSymbol: ${lastError.requestedSymbol}. Provider: ${lastError.provider}.${lastError.httpStatus ? ` HTTP status: ${lastError.httpStatus}.` : ''}${lastError.reason ? ` Reason: ${lastError.reason}.` : ''}`,
            provider: lastError.provider,
            httpStatus: lastError.httpStatus,
            reason: lastError.reason,
            requestedSymbol: lastError.requestedSymbol,
          } satisfies QuoteErrorPayload
        : { symbol: rawSymbol, code: 'provider_error', message: 'No market data provider returned a quote.' } satisfies QuoteErrorPayload;
      cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
      return NextResponse.json(payload, { status: payload.code === 'ticker_not_found' ? 404 : payload.code === 'rate_limited' ? 429 : 502 });
    }

    if (winningPayload.currency === 'USD') {
      try {
        const usdToGbp = await fetchUsdToGbpRate();
        const payload = normalizeQuotePayload(
          winningPayload.symbol,
          winningPayload.price,
          winningPayload.currency,
          winningPayload.asOf,
          winningPayload.source,
          winningPayload.displayName,
          winningPayload.exchange,
          winningPayload.sourceId,
          usdToGbp.rate,
          usdToGbp.date,
        );
        cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
        return NextResponse.json(payload);
      } catch (error) {
        const payload = {
          symbol: rawSymbol,
          code: 'exchange_rate_error',
          message: error instanceof Error ? error.message : 'Failed to convert USD quote to GBP.',
          provider: winningPayload.source,
        } satisfies QuoteErrorPayload;
        cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
        return NextResponse.json(payload, { status: 502 });
      }
    }

    if (winningPayload.currency !== 'GBP') {
      const payload = {
        symbol: rawSymbol,
        code: 'unsupported_currency',
        message: `Unsupported quote currency: ${winningPayload.currency}`,
        provider: winningPayload.source,
      } satisfies QuoteErrorPayload;
      cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
      return NextResponse.json(payload, { status: 422 });
    }

    const payload = normalizeQuotePayload(
      winningPayload.symbol,
      winningPayload.price,
      winningPayload.currency,
      winningPayload.asOf,
      winningPayload.source,
      winningPayload.displayName,
      winningPayload.exchange,
      winningPayload.sourceId,
      1,
      winningPayload.asOf,
    );
    cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    return errorResponse(
      rawSymbol,
      'network_error',
      error instanceof Error ? error.message : 'Failed to load market data.',
      502,
    );
  }
}
