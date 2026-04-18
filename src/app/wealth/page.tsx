'use client';

import Link from 'next/link';
import { Home, Landmark, PiggyBank, CreditCard, Briefcase, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import NetWorthTile from '@/components/ui/NetWorthTile';
import Tile from '@/components/ui/Tile';
import { useWealthCalc, type WealthCalc } from '@/lib/wealthCalc';
import { fmtCurrency } from '@/lib/format';

// ─── Page ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    href:     '/wealth/properties',
    label:    'Properties',
    icon:     Home,
    colour:   '#6366f1',
    bg:       '#6366f122',
    getValue: (t: WealthCalc) => t.propertyAssets,
    caption:  'Current value',
  },
  {
    href:     '/wealth/mortgages',
    label:    'Mortgages',
    icon:     Landmark,
    colour:   '#f59e0b',
    bg:       '#f59e0b22',
    getValue: (t: WealthCalc) => t.mortgageLiabilities,
    caption:  'Outstanding',
  },
  {
    href:     '/wealth/savings',
    label:    'Savings',
    icon:     PiggyBank,
    colour:   '#10b981',
    bg:       '#10b98122',
    getValue: (t: WealthCalc) => t.savingsAssets,
    caption:  'Total balance',
  },
  {
    href:     '/wealth/debts',
    label:    'Debts',
    icon:     CreditCard,
    colour:   '#f43f5e',
    bg:       '#f43f5e22',
    getValue: (t: WealthCalc) => t.debtLiabilities,
    caption:  'Outstanding',
  },
  {
    href:     '/wealth/pensions',
    label:    'Pensions',
    icon:     Briefcase,
    colour:   '#3b82f6',
    bg:       '#3b82f622',
    getValue: (t: WealthCalc) => t.pensionAssets,
    caption:  'Total value',
  },
] as const;

export default function WealthPage() {
  const totals = useWealthCalc();

  return (
    <>
      <PageHeader title="Wealth" />

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        <NetWorthTile netWorth={totals.netWorth} />

        {/* Assets / Liabilities */}
        <div className="grid grid-cols-2 gap-3">
          <Tile
            title="Total Assets"
            value={fmtCurrency(totals.totalAssets)}
            align="center"
            valueClassName="font-bold text-[clamp(0.95rem,3.6vw,1.35rem)]"
            valueStyle={{ color: '#10b981' }}
          />
          <Tile
            title="Total Liabilities"
            value={fmtCurrency(totals.totalLiabilities)}
            align="center"
            valueClassName="font-bold text-[clamp(0.95rem,3.6vw,1.35rem)]"
            valueStyle={{ color: '#f43f5e' }}
          />
        </div>
      </div>

      {/* ── Category tiles ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SECTIONS.map(({ href, label, icon: Icon, colour, bg, getValue, caption }) => {
          const value = getValue(totals);
          return (
            <Tile
              key={href}
              as={Link}
              href={href}
              layout="inline"
              size="sm"
              interactive
              inlineStackOnMobile={false}
              title={label}
              subtitle={caption}
              value={fmtCurrency(value)}
              className="min-h-0"
              leading={
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9"
                  style={{ background: bg }}
                >
                  <Icon size={16} style={{ color: colour }} />
                </div>
              }
              trailing={<ChevronRight size={15} className="text-[var(--muted)]" />}
              titleClassName="text-sm font-semibold text-[var(--foreground)]"
              subtitleClassName="mt-0.5"
              valueClassName="text-[0.95rem] sm:text-sm"
            />
          );
        })}
      </div>
    </>
  );
}
