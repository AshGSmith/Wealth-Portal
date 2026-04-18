'use client';

import {
  Briefcase,
  CreditCard,
  Home,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ReportLinkCard from '@/components/reports/ReportLinkCard';

const REPORTS = [
  {
    href: '/reports/net-worth',
    title: 'Detailed Net Worth',
    description: 'Review full asset and liability totals in one place.',
    icon: TrendingUp,
    color: '#10b981',
    background: '#10b98122',
  },
  {
    href: '/reports/property-information',
    title: 'Property Information',
    description: 'See property values, purchase details, and linked mortgages.',
    icon: Home,
    color: '#6366f1',
    background: '#6366f122',
  },
  {
    href: '/reports/savings-insight',
    title: 'Savings Insight',
    description: 'Track account balances, history coverage, and cash totals.',
    icon: PiggyBank,
    color: '#10b981',
    background: '#10b98122',
  },
  {
    href: '/reports/debt-insight',
    title: 'Debt Insight',
    description: 'Understand loan and credit card balances at a glance.',
    icon: CreditCard,
    color: '#f43f5e',
    background: '#f43f5e22',
  },
  {
    href: '/reports/income-trends',
    title: 'Income Trends',
    description: 'Compare recent monthly income and source performance.',
    icon: Briefcase,
    color: '#2563eb',
    background: '#2563eb22',
  },
] as const;

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Open a focused view of your financial reports." />

      <div className="space-y-2">
        {REPORTS.map(report => (
          <ReportLinkCard key={report.href} {...report} />
        ))}
      </div>
    </>
  );
}
