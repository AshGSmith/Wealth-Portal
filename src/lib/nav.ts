import {
  LayoutDashboard, Wallet, TrendingUp,
  Receipt, PiggyBank, Banknote, Layers, FileBarChart,
} from 'lucide-react';

export const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/budget',    label: 'Budget',    icon: Wallet },
  { href: '/wealth',    label: 'Wealth',    icon: TrendingUp },
] as const;

export const SECONDARY_NAV = [
  { href: '/income',   label: 'Income',   icon: Banknote },
  { href: '/pots',     label: 'Pots',     icon: Layers },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/savings',  label: 'Savings',  icon: PiggyBank },
  { href: '/reports',  label: 'Reports',  icon: FileBarChart },
] as const;

// All nav items combined — used where the full list is needed
export const NAV_ITEMS = [...PRIMARY_NAV, ...SECONDARY_NAV] as const;
