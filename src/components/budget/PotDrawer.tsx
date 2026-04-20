'use client';

import { AlertCircle, AlertTriangle, Lock } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import ReportInsightTable from '@/components/reports/ReportInsightTable';
import type { Pot, IncomeSource } from '@/lib/types';
import type { ResolvedLineItem } from '@/lib/budgetLogic';
import type { SourceCalc } from '@/lib/budgetCalc';
import { fmtCurrency } from '@/lib/format';

interface Props {
  pot: Pot;
  items: ResolvedLineItem[];
  allPots: Pot[];
  allSources: IncomeSource[];
  sourceCalcs: SourceCalc[];
  sourceLabel: string;
  locked: boolean;
  open: boolean;
  onClose: () => void;
  onMoveToPot: (itemId: string, newPotId: string) => void;
  onMoveToIncomeSource: (itemId: string, incomeSourceId: string) => void;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function ItemRow({ item, allPots, allSources, locked, onMoveToPot, onMoveToIncomeSource }: {
  item: ResolvedLineItem;
  allPots: Pot[];
  allSources: IncomeSource[];
  locked: boolean;
  onMoveToPot: (id: string, potId: string) => void;
  onMoveToIncomeSource: (id: string, incomeSourceId: string) => void;
}) {
  const isMoved = item.potId !== item.defaultPotId;
  const isSourceOverridden = item.incomeSourceId !== item.defaultIncomeSourceId;
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
        {locked ? (
          <span
            className="flex-1 min-w-0 rounded border px-2 py-0.5 text-xs"
            style={{ borderColor: isMoved ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)' }}
          >
            {item.potName}
          </span>
        ) : (
          <select value={item.potId} onChange={e => onMoveToPot(item.id, e.target.value)}
            className="flex-1 min-w-0 rounded border py-0.5 pl-2 pr-1 text-xs outline-none transition-colors"
            style={{ background: 'transparent', borderColor: isMoved ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const }}>
            {allPots.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {isMoved && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>moved</span>}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}>
          source
        </span>
        {locked ? (
          <span
            className="flex-1 min-w-0 rounded border px-2 py-0.5 text-xs"
            style={{ borderColor: isSourceOverridden ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)' }}
          >
            {item.incomeSourceName}
          </span>
        ) : (
          <select value={item.incomeSourceId} onChange={e => onMoveToIncomeSource(item.id, e.target.value)}
            className="flex-1 min-w-0 rounded border py-0.5 pl-2 pr-1 text-xs outline-none transition-colors"
            style={{ background: 'transparent', borderColor: isSourceOverridden ? 'var(--primary)' : 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const }}>
            {allSources.filter(source => !source.archived).map(source => <option key={source.id} value={source.id}>{source.provider}</option>)}
          </select>
        )}
        {isSourceOverridden && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>override</span>}
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export default function PotDrawer({ pot, items, allPots, allSources, sourceCalcs, sourceLabel, locked, open, onClose, onMoveToPot, onMoveToIncomeSource }: Props) {
  const totalRequired = items.reduce((s, i) => s + i.amount, 0);
  const movedCount    = items.filter(i => i.potId !== i.defaultPotId).length;
  const hasOverAllocation = sourceCalcs.some(sourceCalc => sourceCalc.isOverAllocated);

  const sorted = [...items].sort((a, b) => {
    if (a.sourceType !== b.sourceType) return a.sourceType === 'expense' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>{pot.name}</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
        {sourceLabel}
        {' · '}
        <span style={{ color: 'var(--foreground)' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        {movedCount > 0 && <span className="ml-1.5" style={{ color: 'var(--primary)' }}>· {movedCount} moved</span>}
      </p>
    </div>
  );

  const footer = (
    <div className="px-5 pt-4 space-y-3">
      <div className="flex justify-between text-sm">
        <span style={{ color: 'var(--muted)' }}>This pot</span>
        <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(totalRequired)}</span>
      </div>
      <ReportInsightTable
        title="Income Source Allocation"
        columns={[
          { label: 'Source' },
          { label: 'Allocated', align: 'right' },
          { label: 'Income', align: 'right' },
          { label: 'Balance', align: 'right' },
        ]}
        rows={sourceCalcs.map(sourceCalc => ([
          { content: sourceCalc.source.provider, strong: true, truncate: true },
          { content: fmtCurrency(sourceCalc.allocated), align: 'right' as const, tone: 'value' as const },
          { content: fmtCurrency(sourceCalc.income), align: 'right' as const, tone: 'value' as const },
          {
            content: `${sourceCalc.surplus >= 0 ? '+' : ''}${fmtCurrency(sourceCalc.surplus)}`,
            align: 'right' as const,
            tone: 'value' as const,
            color: sourceCalc.surplus >= 0 ? '#10b981' : '#f43f5e',
          },
        ]))}
      />
      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t"
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-1.5">
          {hasOverAllocation && <AlertTriangle size={13} className="text-amber-500" />}
          <span style={{ color: hasOverAllocation ? '#f59e0b' : 'var(--foreground)' }}>
            {hasOverAllocation ? 'Over-allocation detected' : 'All linked sources balanced'}
          </span>
        </div>
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
            <ItemRow
              key={item.id}
              item={item}
              allPots={allPots}
              allSources={allSources}
              locked={locked}
              onMoveToPot={onMoveToPot}
              onMoveToIncomeSource={onMoveToIncomeSource}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
