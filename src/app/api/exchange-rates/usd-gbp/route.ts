import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD&quotes=GBP', {
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
    }

    const data = await response.json() as Array<{
      date: string;
      base: string;
      quote: string;
      rate: number;
    }>;
    const rateRow = data.find(entry => entry.base === 'USD' && entry.quote === 'GBP') ?? data[0];

    if (!rateRow?.rate || !rateRow?.date) {
      return NextResponse.json({ message: 'Exchange rate unavailable.' }, { status: 502 });
    }

    return NextResponse.json({
      rateToGbp: rateRow.rate,
      rateDate: rateRow.date,
      source: 'Frankfurter',
    });
  } catch {
    return NextResponse.json({ message: 'Failed to load exchange rate.' }, { status: 502 });
  }
}
