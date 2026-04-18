'use client';

import { Children, type ReactNode } from 'react';
import ReportLayout from '@/components/reports/ReportLayout';
import ReportSection from '@/components/reports/ReportSection';
import NetWorthTile from '@/components/ui/NetWorthTile';
import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import { mortgageBalance, mortgageLiability, useWealthCalc } from '@/lib/wealthCalc';

function fmtPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

type BreakdownRowProps = {
  label: string;
  meta?: string;
  value: string;
  valueColor?: string;
};

function BreakdownRow({ label, meta, value, valueColor }: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {label}
        </p>
        {meta ? (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            {meta}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-right" style={{ color: valueColor ?? 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

type SectionCardProps = {
  title: string;
  total: string;
  totalColor?: string;
  emptyLabel: string;
  children: ReactNode;
};

function SectionCard({ title, total, totalColor, emptyLabel, children }: SectionCardProps) {
  const hasContent = Children.count(children) > 0;

  return (
    <ReportSection title={title}>
      <div className="rounded-2xl border p-3 space-y-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-end justify-between gap-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {title}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Items contributing to this total
            </p>
          </div>
          <p className="text-base font-semibold tabular-nums text-right" style={{ color: totalColor ?? 'var(--foreground)' }}>
            {total}
          </p>
        </div>

        <div className="space-y-1.5">
          {hasContent ? children : (
            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
              {emptyLabel}
            </p>
          )}
        </div>
      </div>
    </ReportSection>
  );
}

export default function NetWorthReportPage() {
  const totals = useWealthCalc();
  const store = useStore();

  const properties = store.properties.filter(property => !property.archived);
  const savingsAccounts = store.savingsAccounts.filter(account => !account.archived);
  const pensions = store.pensions.filter(pension => !pension.archived);
  const mortgages = store.mortgages.filter(mortgage => !mortgage.archived);
  const debts = store.debts.filter(debt => !debt.archived);

  return (
    <ReportLayout title="Detailed Net Worth" subtitle="Current net worth with full asset and liability breakdown.">
      <NetWorthTile netWorth={totals.netWorth} />

      <ReportSection title="Summary">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Tile title="Current Net Worth" value={fmtCurrency(totals.netWorth)} valueStyle={{ color: '#2563eb' }} />
          <Tile title="Total Assets" value={fmtCurrency(totals.totalAssets)} valueStyle={{ color: '#10b981' }} />
          <Tile title="Total Liabilities" value={fmtCurrency(totals.totalLiabilities)} valueStyle={{ color: '#f43f5e' }} />
        </div>
      </ReportSection>

      <SectionCard
        title="Properties"
        total={fmtCurrency(totals.propertyAssets)}
        totalColor="#6366f1"
        emptyLabel="No active properties."
      >
        {properties.map(property => (
          <BreakdownRow
            key={property.id}
            label={property.name}
            meta={property.address}
            value={fmtCurrency(property.currentValue)}
            valueColor="#6366f1"
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Savings Accounts"
        total={fmtCurrency(totals.savingsAssets)}
        totalColor="#10b981"
        emptyLabel="No active savings accounts."
      >
        {savingsAccounts.map(account => (
          <BreakdownRow
            key={account.id}
            label={account.name}
            meta={account.interestRate > 0 ? `Interest rate ${fmtPercent(account.interestRate)}` : undefined}
            value={fmtCurrency(account.currentBalance)}
            valueColor="#10b981"
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Pensions"
        total={fmtCurrency(totals.pensionAssets)}
        totalColor="#2563eb"
        emptyLabel="No active pensions."
      >
        {pensions.map(pension => (
          <BreakdownRow
            key={pension.id}
            label={pension.name}
            meta={pension.provider}
            value={fmtCurrency(pension.currentBalance)}
            valueColor="#2563eb"
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Mortgages"
        total={fmtCurrency(totals.mortgageLiabilities)}
        totalColor="#f59e0b"
        emptyLabel="No active mortgages."
      >
        {mortgages.map(mortgage => {
          const linkedProperty = store.properties.find(property => property.mortgageId === mortgage.id && !property.archived);
          const outstandingBalance = mortgageBalance(mortgage, store.mortgagePayments);
          const totalLiability = mortgageLiability(mortgage, store.mortgagePayments);
          const metaParts = [
            linkedProperty ? linkedProperty.name : undefined,
            `Outstanding ${fmtCurrency(outstandingBalance)}`,
          ].filter(Boolean);

          return (
            <BreakdownRow
              key={mortgage.id}
              label={mortgage.lender}
              meta={metaParts.join(' • ')}
              value={fmtCurrency(totalLiability)}
              valueColor="#f59e0b"
            />
          );
        })}
      </SectionCard>

      <SectionCard
        title="Debts"
        total={fmtCurrency(totals.debtLiabilities)}
        totalColor="#f43f5e"
        emptyLabel="No active debts."
      >
        {debts.map(debt => (
          <BreakdownRow
            key={debt.id}
            label={debt.name}
            meta={`${debt.provider} • ${debt.debtType === 'credit-card' ? 'Credit Card' : 'Loan'}`}
            value={fmtCurrency(debt.currentBalance)}
            valueColor="#f43f5e"
          />
        ))}
      </SectionCard>
    </ReportLayout>
  );
}
