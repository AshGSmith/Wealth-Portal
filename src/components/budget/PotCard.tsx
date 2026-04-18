import { ChevronRight, AlertTriangle } from 'lucide-react';
import Tile from '@/components/ui/Tile';
import type { Pot } from '@/lib/types';
import type { ResolvedLineItem } from '@/lib/budgetLogic';
import { fmtCurrency } from '@/lib/format';

interface Props {
  pot: Pot;
  expenses: ResolvedLineItem[];
  savings: ResolvedLineItem[];
  sourceLabel: string;
  accentColor: string;
  sourceBreakdown?: Array<{ label: string; amount: string }>;
  isOverAllocated: boolean;
  onClick: () => void;
}


export default function PotCard({ pot, expenses, savings, sourceLabel, accentColor, sourceBreakdown = [], isOverAllocated, onClick }: Props) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSavings  = savings.reduce((s, e)  => s + e.amount, 0);
  const total         = totalExpenses + totalSavings;
  const showBreakdown = sourceBreakdown.length > 1;

  return (
    <Tile
      as="button"
      onClick={onClick}
      type="button"
      layout="inline"
      title={pot.name}
      subtitle={sourceLabel}
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
          style={{ background: accentColor + '22' }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: accentColor }} />
        </div>
      }
      size="sm"
      subtitleClassName={isOverAllocated ? 'mt-0.5 text-amber-500' : 'mt-0.5'}
      valueClassName="text-[clamp(0.95rem,3.2vw,1.05rem)]"
      valueStyle={{ color: 'var(--foreground)' }}
      style={{ borderColor: isOverAllocated ? '#f59e0b44' : undefined }}
      footer={showBreakdown ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          {sourceBreakdown.map(item => (
            <span key={item.label} className="tabular-nums">
              {item.label}: {item.amount}
            </span>
          ))}
        </div>
      ) : undefined}
      footerClassName="mt-2"
    />
  );
}
