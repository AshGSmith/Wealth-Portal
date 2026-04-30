import { NextRequest, NextResponse } from 'next/server';

type SearchResult = {
  symbol: string;
  displayName: string;
  exchange: string | null;
  currency: string | null;
  source: string | null;
  sourceId: string | null;
};

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; payload: SearchResult[] }>();

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const normalizedQuery = query.toUpperCase();
  const cached = cache.get(normalizedQuery);
  if (cached && (Date.now() - cached.fetchedAt) < SEARCH_CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.payload });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ results: [], message: 'Instrument search provider unavailable.' }, { status: 502 });
    }

    const data = await response.json() as {
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchDisp?: string;
        exchange?: string;
        currency?: string;
        quoteType?: string;
      }>;
    };

    const allowedTypes = new Set(['EQUITY', 'ETF', 'MUTUALFUND', 'FUND']);
    const results = (data.quotes ?? [])
      .filter(item => item.symbol && (item.quoteType ? allowedTypes.has(item.quoteType.toUpperCase()) : true))
      .map(item => ({
        symbol: item.symbol!.trim().toUpperCase(),
        displayName: item.longname?.trim() || item.shortname?.trim() || item.symbol!.trim().toUpperCase(),
        exchange: item.exchDisp?.trim() || item.exchange?.trim() || null,
        currency: item.currency?.trim().toUpperCase() || null,
        source: 'Yahoo Finance',
        sourceId: item.symbol!.trim().toUpperCase(),
      }))
      .filter((item, index, arr) => arr.findIndex(other => other.symbol === item.symbol) === index);

    cache.set(normalizedQuery, { fetchedAt: Date.now(), payload: results });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], message: 'Instrument search failed due to a network error.' }, { status: 502 });
  }
}
