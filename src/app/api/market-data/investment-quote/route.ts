import { NextRequest, NextResponse } from 'next/server';

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; payload: unknown }>();

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

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get('symbol')?.trim().toUpperCase() ?? '';
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();

  if (!rawSymbol) {
    return NextResponse.json({ message: 'Missing symbol.' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ message: 'Market data not configured.' }, { status: 503 });
  }

  const cached = cache.get(rawSymbol);
  if (cached && (Date.now() - cached.fetchedAt) < QUOTE_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(rawSymbol)}&apikey=${encodeURIComponent(apiKey)}`;
    const quoteResponse = await fetch(quoteUrl, { cache: 'no-store' });

    if (!quoteResponse.ok) {
      return NextResponse.json({ message: 'Failed to load market data.' }, { status: 502 });
    }

    const quoteJson = await quoteResponse.json() as Record<string, Record<string, string>>;
    const quoteData = quoteJson['Global Quote'];
    const price = quoteData ? Number(quoteData['05. price']) : NaN;
    const latestTradingDay = quoteData?.['07. latest trading day'] ?? null;
    let currency = inferCurrencyFromSymbol(rawSymbol);

    if (!currency) {
      const overviewCurrency = await fetchOverviewCurrency(rawSymbol, apiKey);
      currency = overviewCurrency === 'USD' || overviewCurrency === 'GBP' ? overviewCurrency : null;
    }

    if (!Number.isFinite(price) || !latestTradingDay) {
      return NextResponse.json({ message: 'Ticker not found or market data unavailable.' }, { status: 404 });
    }

    if (!currency) {
      return NextResponse.json({ message: `Could not determine quote currency for ${rawSymbol}.` }, { status: 422 });
    }

    let priceGbp = price;
    if (currency === 'USD') {
      const usdToGbp = await fetchUsdToGbpRate();
      priceGbp = price * usdToGbp.rate;
      const payload = {
        symbol: rawSymbol,
        price,
        currency,
        priceGbp,
        asOf: latestTradingDay,
        source: 'Alpha Vantage',
        exchangeRateToGbp: usdToGbp.rate,
        exchangeRateDate: usdToGbp.date,
      };
      cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
      return NextResponse.json(payload);
    }

    if (currency !== 'GBP') {
      return NextResponse.json({ message: `Unsupported quote currency: ${currency}` }, { status: 422 });
    }

    const payload = {
      symbol: rawSymbol,
      price,
      currency,
      priceGbp,
      asOf: latestTradingDay,
      source: 'Alpha Vantage',
      exchangeRateToGbp: 1,
      exchangeRateDate: latestTradingDay,
    };
    cache.set(rawSymbol, { fetchedAt: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to load market data.' },
      { status: 502 },
    );
  }
}
