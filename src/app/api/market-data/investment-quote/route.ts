import { NextRequest, NextResponse } from 'next/server';

const QUOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; payload: unknown }>();

async function fetchUsdToGbpRate() {
  const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
    cache: 'no-store',
  });

  if (!response.ok) throw new Error('Failed to load USD to GBP exchange rate.');
  const data = await response.json() as Array<{ base: string; quote: string; rate: number; date: string }>;
  const row = data.find(entry => entry.base === 'USD' && entry.quote === 'GBP') ?? data[0];
  if (!row?.rate || !row?.date) throw new Error('USD to GBP exchange rate unavailable.');
  return { rate: row.rate, date: row.date };
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
    const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(rawSymbol)}&apikey=${encodeURIComponent(apiKey)}`;

    const [quoteResponse, overviewResponse] = await Promise.all([
      fetch(quoteUrl, { cache: 'no-store' }),
      fetch(overviewUrl, { cache: 'no-store' }),
    ]);

    if (!quoteResponse.ok || !overviewResponse.ok) {
      return NextResponse.json({ message: 'Failed to load market data.' }, { status: 502 });
    }

    const quoteJson = await quoteResponse.json() as Record<string, Record<string, string>>;
    const overviewJson = await overviewResponse.json() as Record<string, string>;
    const quoteData = quoteJson['Global Quote'];
    const price = quoteData ? Number(quoteData['05. price']) : NaN;
    const latestTradingDay = quoteData?.['07. latest trading day'] ?? null;
    const currency = (overviewJson.Currency ?? '').toUpperCase();

    if (!Number.isFinite(price) || !latestTradingDay || !currency) {
      return NextResponse.json({ message: 'Ticker not found or market data unavailable.' }, { status: 404 });
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
