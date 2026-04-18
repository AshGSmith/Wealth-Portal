'use client';

import { AlertCircle, AlertTriangle, Lock } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import type { Pot, IncomeSource } from '@/lib/types';
import type { ResolvedLineItem } from '@/lib/budgetLogic';
import type { SourceCalc } from '@/lib/budgetCalc';
import { fmtCurrency, fmtSourceType } from '@/lib/format';

interface Props {
  pot:         Pot;
  source:      IncomeSource;
  items:       ResolvedLineItem[];
  allPots:     Pot[];
  sourceCalc:  SourceCalc;
  locked:      boolean;
  open:        boolean;
  onClose:     () => void;
  onMoveToPot: (itemId: string, newPotId: string) => void;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ItemRow({ item, allPots, locked, onMoveToPot }: {
  item: ResolvedLineItem; allPots: Pot[]; locked: boolean; onMoveToPot: (id: string, potId: string) => void;
}) {
  const isMoved = item.potId !== item.defaultPotId;
  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {item.isCritical && <AlertCircle size={13} className="shrink-0 mt-px text-amber-500" />}
          <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{item.name}</span>
        </div>
        <span className="text-sm font-semibold shrink-0 tabular-nums" style={{ color: 'var(--foreground)' }}>
          {fmtCurrency(item.amount)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={item.sourceType === 'expense'
            ? { background: 'var(--surface-hover)', color: 'var(--muted)' }
            : { background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {item.sourceType}
        </span>
        <select value={item.potId} onChange={e => onMoveToPot(item.id, e.target.value)}
          disabled={locked}
          className="flex-1 min-w-0 rounded border py-0.5 pl-2 pr-1 text-xs outline-none transition-colors"
          style={{ background: 'transparent', borderColor: isMoved ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const, opacity: locked ? 0.5 : 1 }}>
          {allPots.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isMoved && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>moved</span>}
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PotDrawer({ pot, source, items, allPots, sourceCalc, locked, open, onClose, onMoveToPot }: Props) {
  const totalRequired = items.reduce((s, i) => s + i.amount, 0);
  const movedCount    = items.filter(i => i.potId !== i.defaultPotId).length;
  const { income, allocated, isOverAllocated, surplus } = sourceCalc;

  const sorted = [...items].sort((a, b) => {
    if (a.sourceType !== b.sourceType) return a.sourceType === 'expense' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{pot.name}</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
        {source.provider} · {fmtSourceType(source.type)}
        {' · '}
        <span style={{ color: 'var(--foreground)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        {movedCount > 0 && <span className="ml-1.5" style={{ color: 'var(--primary)' }}>· {movedCount} moved</span>}
      </p>
    </div>
  );

  const footer = (
    <div className="px-5 pt-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--muted)' }}>This pot</span>
        <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(totalRequired)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--muted)' }}>
          {source.provider} total
          {sourceCalc.pots.length > 1 && <span className="ml-1">({sourceCalc.pots.length} pots)</span>}
        </span>
        <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(allocated)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--muted)' }}>{source.provider} income</span>
        <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(income)}</span>
      </div>
      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5">
          {isOverAllocated && <AlertTriangle size={13} className="text-amber-500" />}
          <span style={{ color: isOverAllocated ? '#f59e0b' : 'var(--foreground)' }}>
            {isOverAllocated ? 'Over-allocated' : 'Source balance'}
          </span>
        </div>
        <span style={{ color: surplus >= 0 ? '#10b981' : '#f43f5e' }}>
          {surplus >= 0 ? '+' : ''}{fmtCurrency(surplus)}
        </span>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      {/* Column headers */}
      {sorted.length > 0 && (
        <div className="grid px-5 py-2 border-b text-[10px] font-semibold uppercase tracking-wide"
          style={{ borderColor: 'var(--border)', gridTemplateColumns: '1fr auto', color: 'var(--muted)' }}>
          <span>Name · Type · Pot</span>
          <span>Amount</span>
        </div>
      )}

      {/* Item list */}
      {sorted.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>No items in this pot.</p>
      ) : (
        <div className="divide-y px-5" style={{ borderColor: 'var(--border)' }}>
          {locked && (
            <div className="flex items-center gap-1.5 py-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Lock size={11} />
              <span>Budget is locked — pot assignments cannot be changed.</span>
            </div>
          )}
          {sorted.map(item => (
            <ItemRow key={item.id} item={item} allPots={allPots} locked={locked} onMoveToPot={onMoveToPot} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
