import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
    }

    const data = await response.json() as
      | {
          amount?: number;
          base?: string;
          date?: string;
          rates?: Record<string, number>;
        }
      | Array<{ date?: string; quote?: string; rate?: number }>;
    const latest = Array.isArray(data)
      ? data.find(entry => entry.quote?.toUpperCase() === 'GBP' && Number.isFinite(entry.rate))
      : null;
    const rate = Array.isArray(data) ? latest?.rate ?? null : data.rates?.GBP ?? null;
    const rateDate = Array.isArray(data) ? latest?.date ?? null : data.date ?? null;

    if (!rate || !rateDate) {
      return NextResponse.json({ message: 'Exchange rate unavailable.' }, { status: 502 });
    }

    return NextResponse.json({
      rateToGbp: rate,
      rateDate,
      source: 'Frankfurter',
    });
  } catch {
    return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
  }
}
