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
  exchangeRateToGbp: number;
  exchangeRateDate: string;
};

type QuoteErrorPayload = {
  symbol: string;
  code: 'missing_symbol' | 'missing_api_key' | 'provider_error' | 'ticker_not_found' | 'rate_limited' | 'network_error' | 'unsupported_currency' | 'exchange_rate_error';
  message: string;
  provider?: string;
};

async function fetchUsdToGbpRate() {
  const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to load USD to GBP exchange rate.');
  const data = await response.json() as {
    date?: string;
    rates?: Record<string, number>;
  };
  const rate = data.rates?.GBP ?? null;
  if (!rate || !data.date) throw new Error('USD to GBP exchange rate unavailable.');
  return { rate, date: data.date };
}

function errorResponse(
  symbol: string,
  code: QuoteErrorPayload['code'],
  message: string,
  status: number,
  provider?: string,
) {
  return NextResponse.json({ symbol, code, message, provider } satisfies QuoteErrorPayload, { status });
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
    exchangeRateToGbp,
    exchangeRateDate,
  };
}

async function fetchYahooQuote(symbol: string): Promise<
  | { ok: true; payload: Omit<QuotePayload, 'priceGbp' | 'exchangeRateToGbp' | 'exchangeRateDate'> }
  | { ok: false; code: QuoteErrorPayload['code']; message: string; provider: string }
> {
  const provider = 'Yahoo Finance';

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return { ok: false, code: 'provider_error', message: 'Yahoo Finance did not return a quote.', provider };
    }

    const data = await response.json() as {
      quoteResponse?: {
        result?: Array<{
          symbol?: string;
          currency?: string;
          regularMarketPrice?: number;
          regularMarketTime?: number;
        }>;
      };
    };

    const result = data.quoteResponse?.result?.[0];
    const price = result?.regularMarketPrice;
    const currency = result?.currency?.toUpperCase() ?? null;
    const resolvedSymbol = result?.symbol?.toUpperCase() ?? symbol;
    const marketTime = result?.regularMarketTime
      ? new Date(result.regularMarketTime * 1000).toISOString().slice(0, 10)
      : null;

    if (!Number.isFinite(price) || !currency || !marketTime) {
      return { ok: false, code: 'ticker_not_found', message: `Ticker ${symbol} was not found on Yahoo Finance.`, provider };
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
      },
    };
  } catch {
    return { ok: false, code: 'network_error', message: 'Yahoo Finance lookup failed due to a network error.', provider };
  }
}

async function fetchAlphaVantageQuote(symbol: string, apiKey: string): Promise<
  | { ok: true; payload: Omit<QuotePayload, 'priceGbp' | 'exchangeRateToGbp' | 'exchangeRateDate'> }
  | { ok: false; code: QuoteErrorPayload['code']; message: string; provider: string }
> {
  const provider = 'Alpha Vantage';

  try {
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const quoteResponse = await fetch(quoteUrl, { cache: 'no-store' });

    if (!quoteResponse.ok) {
      return { ok: false, code: 'provider_error', message: 'Alpha Vantage did not return a quote.', provider };
    }

    const quoteJson = await quoteResponse.json() as Record<string, string | Record<string, string>>;
    if (typeof quoteJson.Note === 'string' && quoteJson.Note.length > 0) {
      return { ok: false, code: 'rate_limited', message: 'Alpha Vantage rate limit reached.', provider };
    }
    if (typeof quoteJson['Error Message'] === 'string' && quoteJson['Error Message'].length > 0) {
      return { ok: false, code: 'ticker_not_found', message: `Ticker ${symbol} was not found on Alpha Vantage.`, provider };
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
      return { ok: false, code: 'ticker_not_found', message: `Ticker ${symbol} was not found on Alpha Vantage.`, provider };
    }

    if (!currency) {
      return { ok: false, code: 'unsupported_currency', message: `Could not determine quote currency for ${symbol}.`, provider };
    }

    return {
      ok: true,
      payload: {
        symbol,
        price,
        currency,
        asOf: latestTradingDay,
        source: provider,
      },
    };
  } catch {
    return { ok: false, code: 'network_error', message: 'Alpha Vantage lookup failed due to a network error.', provider };
  }
}

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();

  if (!rawSymbol) {
    return errorResponse(rawSymbol, 'missing_symbol', 'Missing symbol.', 400);
  }

  const cached = cache.get(rawSymbol);
  if (cached && (Date.now() - cached.fetchedAt) < QUOTE_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const providerResults: Array<
      | { ok: true; payload: Omit<QuotePayload, 'priceGbp' | 'exchangeRateToGbp' | 'exchangeRateDate'> }
      | { ok: false; code: QuoteErrorPayload['code']; message: string; provider: string }
    > = [];

    const yahooResult = await fetchYahooQuote(rawSymbol);
    providerResults.push(yahooResult);
    let winningPayload = yahooResult.ok ? yahooResult.payload : null;

    if (!winningPayload && apiKey) {
      const alphaResult = await fetchAlphaVantageQuote(rawSymbol, apiKey);
      providerResults.push(alphaResult);
      winningPayload = alphaResult.ok ? alphaResult.payload : null;
    }

    if (!winningPayload) {
      const lastError = [...providerResults].reverse().find(result => !result.ok);
      if (!apiKey && lastError) {
        const payload = {
          symbol: rawSymbol,
          code: lastError.code,
          message: `${lastError.message} No Alpha Vantage API key is configured for fallback.`,
          provider: lastError.provider,
        } satisfies QuoteErrorPayload;
        cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
        return NextResponse.json(payload, { status: payload.code === 'ticker_not_found' ? 404 : payload.code === 'rate_limited' ? 429 : 503 });
      }

      const payload = lastError
        ? { symbol: rawSymbol, code: lastError.code, message: lastError.message, provider: lastError.provider } satisfies QuoteErrorPayload
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
