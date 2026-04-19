import {
  LayoutDashboard, Wallet, TrendingUp,
  Receipt, PiggyBank, Banknote, Layers, FileBarChart, Users,
} from 'lucide-react';

export const PRIMARY_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/budget',    label: 'Budget',    icon: Wallet },
  { href: '/wealth',    label: 'Wealth',    icon: TrendingUp },
] as const;

const BASE_SECONDARY_NAV = [
  { href: '/income',   label: 'Income',   icon: Banknote },
  { href: '/pots',     label: 'Pots',     icon: Layers },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/savings',  label: 'Savings',  icon: PiggyBank },
  { href: '/reports',  label: 'Reports',  icon: FileBarChart },
] as const;

const ADMIN_SECONDARY_NAV = [
  { href: '/users', label: 'Users', icon: Users },
] as const;

export function getSecondaryNav(isAdmin: boolean) {
  return isAdmin ? [...BASE_SECONDARY_NAV, ...ADMIN_SECONDARY_NAV] : [...BASE_SECONDARY_NAV];
}

export const SECONDARY_NAV = BASE_SECONDARY_NAV;
