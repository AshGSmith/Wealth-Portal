import { ChevronRight, AlertTriangle } from 'lucide-react';
import Tile from '@/components/ui/Tile';
import type { Pot, IncomeSource } from '@/lib/types';
import type { ResolvedLineItem } from '@/lib/budgetLogic';
import { fmtCurrency } from '@/lib/format';
import { INCOME_SOURCE_COLOURS } from '@/lib/constants';

interface Props {
  pot:             Pot;
  source:          IncomeSource;
  expenses:        ResolvedLineItem[];
  savings:         ResolvedLineItem[];
  isOverAllocated: boolean;
  onClick:         () => void;
}


export default function PotCard({ pot, source, expenses, savings, isOverAllocated, onClick }: Props) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSavings  = savings.reduce((s, e)  => s + e.amount, 0);
  const total         = totalExpenses + totalSavings;
  const colour        = INCOME_SOURCE_COLOURS[source.type as keyof typeof INCOME_SOURCE_COLOURS] ?? '#6b7280';

  return (
    <Tile
      as="button"
      onClick={onClick}
      type="button"
      layout="inline"
      title={pot.name}
      subtitle={source.provider}
      value={fmtCurrency(total)}
      interactive
      inlineStackOnMobile={false}
      className="w-full text-left"
      titleClassName="text-[13px] font-semibold text-[var(--foreground)]"
      trailing={
        <div className="flex items-center gap-1.5 self-center">
          {isOverAllocated && <AlertTriangle size={14} className="text-amber-500" />}
          <ChevronRight size={16} className="text-[var(--muted)]" />
        </div>
      }
      leading={
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: colour + '22' }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
        </div>
      }
      size="sm"
      subtitleClassName={isOverAllocated ? 'mt-0.5 text-amber-500' : 'mt-0.5'}
      valueClassName="text-[clamp(0.95rem,3.2vw,1.05rem)]"
      valueStyle={{ color: 'var(--foreground)' }}
      style={{ borderColor: isOverAllocated ? '#f59e0b44' : undefined }}
    />
  );
}
