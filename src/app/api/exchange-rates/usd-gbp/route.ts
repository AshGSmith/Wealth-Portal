import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
    }

    const data = await response.json() as {
      amount?: number;
      base?: string;
      date: string;
      rates?: Record<string, number>;
    };
    const rate = data.rates?.GBP ?? null;

    if (!rate || !data.date) {
      return NextResponse.json({ message: 'Exchange rate unavailable.' }, { status: 502 });
    }

    return NextResponse.json({
      rateToGbp: rate,
      rateDate: data.date,
      source: 'Frankfurter',
    });
  } catch {
    return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
  }
}
