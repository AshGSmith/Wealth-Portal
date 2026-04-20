'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Lock, LockOpen, Archive, ArchiveRestore, Trash2, ChevronDown, RefreshCw } from 'lucide-react';
import BudgetExportDocument from '@/components/budget/BudgetExportDocument';
import PageHeader from '@/components/layout/PageHeader';
import PotCard from '@/components/budget/PotCard';
import PotDrawer from '@/components/budget/PotDrawer';
import NewBudgetModal from '@/components/budget/NewBudgetModal';
import ReportDownloadButton from '@/components/reports/ReportDownloadButton';
import Tile from '@/components/ui/Tile';
import { INCOME_SOURCE_COLOURS } from '@/lib/constants';
import { downloadReportNodeAsPdf } from '@/components/reports/reportExport';
import { useStore } from '@/lib/store';
import { calcBudget, getSourceCalcsForPot } from '@/lib/budgetCalc';
import type { PotId } from '@/lib/types';
import { fmtCurrency, fmtMonth } from '@/lib/format';

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetPage() {
  const store = useStore();
  const exportRef = useRef<HTMLDivElement | null>(null);

  const [selectedPotId,  setSelectedPot]  = useState<PotId | null>(null);
  const [showNewModal,   setShowNewModal]  = useState(false);
  const [showArchived,   setShowArchived]  = useState(false);

  // After localStorage hydrates, jump to the most recent budget if the stored
  // active month has no budget (e.g. first load or stale pointer).
  useEffect(() => {
    if (!store.hydrated || store.budgets.length === 0) return;
    const hasBudget = store.budgets.some(b => b.month === store.activeBudgetMonth);
    if (!hasBudget) {
      const latest = [...store.budgets].sort((a, b) => b.month.localeCompare(a.month))[0];
      store.setActiveBudgetMonth(latest.month);
    }
  }, [store.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeMonth = store.activeBudgetMonth;

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeBudget   = store.budgets.find(b => b.month === activeMonth) ?? null;
  const activePots     = store.pots.filter(p => !p.archived);
  const isLocked       = activeBudget?.locked ?? false;
  const archivedBudgets = store.budgets.filter(b => b.archived).sort((a, b) => b.month.localeCompare(a.month));

  const calc = activeBudget
    ? calcBudget(activeBudget, activePots, store.sources, store.entries)
    : null;

  const selectedPotCalc    = calc && selectedPotId ? calc.potCalcs.find(pc => pc.potId === selectedPotId) : null;
  const selectedSourceCalcs = calc && selectedPotId ? getSourceCalcsForPot(calc, selectedPotId) : [];
  const visiblePotCalcs = calc ? calc.potCalcs.filter(potCalc => potCalc.items.length > 0) : [];

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleCreate(month: string) {
    // Never overwrite an existing budget — only create if none exists for this month
    if (!store.budgets.some(b => b.month === month)) {
      store.createBudgetForMonth(month);
    }
    store.setActiveBudgetMonth(month);
    setShowNewModal(false);
  }

  function handleMoveToPot(itemId: string, newPotId: string) {
    if (isLocked) return;
    store.moveBudgetItem(activeMonth, itemId, newPotId as PotId);
  }

  function handleMoveToIncomeSource(itemId: string, incomeSourceId: string) {
    if (isLocked) return;
    store.setBudgetItemIncomeSource(activeMonth, itemId, incomeSourceId);
  }

  function handleRefresh() {
    if (isLocked || !activeBudget) return;
    store.refreshBudgetForMonth(activeMonth);
  }

  function handleDelete() {
    store.deleteBudget(activeMonth);
    const remaining = store.budgets.filter(b => b.month !== activeMonth && !b.archived);
    if (remaining.length > 0) {
      const latest = [...remaining].sort((a, b) => b.month.localeCompare(a.month))[0];
      store.setActiveBudgetMonth(latest.month);
    }
  }

  async function handleExportPdf() {
    await downloadReportNodeAsPdf(exportRef.current, `${fmtMonth(activeMonth)} Budget`);
  }

  function sourceLabelForCalcs(sourceCalcs: Array<{ source: { provider: string } }>): string {
    const labels = sourceCalcs.map(sourceCalc => sourceCalc.source.provider);
    if (labels.length === 0) return 'No linked source';
    if (labels.length === 1) return labels[0];
    return `${labels[0]} +${labels.length - 1} more`;
  }

  function accentColorForCalcs(sourceCalcs: Array<{ source: { type: string } }>): string {
    if (sourceCalcs.length !== 1) return '#64748b';
    return INCOME_SOURCE_COLOURS[sourceCalcs[0].source.type as keyof typeof INCOME_SOURCE_COLOURS] ?? '#64748b';
  }

  function sourceBreakdownForCalcs(sourceCalcs: Array<{ source: { provider: string }; allocated: number }>) {
    return sourceCalcs
      .map(sourceCalc => ({
        label: sourceCalc.source.provider,
        amount: fmtCurrency(sourceCalc.allocated),
        rawAmount: sourceCalc.allocated,
      }))
      .sort((a, b) => b.rawAmount - a.rawAmount)
      .map(({ label, amount }) => ({ label, amount }));
  }

  // ── Header actions ───────────────────────────────────────────────────────
  const actions = (
    <button
      onClick={() => setShowNewModal(true)}
      className="print:hidden flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">New Budget</span>
      <span className="sm:hidden">New</span>
    </button>
  );

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Budget" actions={actions} />
      </div>

      {/* Month navigator */}
      <div className="print:hidden rounded-xl border mb-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => store.setActiveBudgetMonth(shiftMonth(activeMonth, -1))}
            className="print:hidden rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {fmtMonth(activeMonth)}
              </p>
              {isLocked && <Lock size={11} style={{ color: 'var(--muted)' }} />}
            </div>
            {activeBudget && (
              <p className="text-xs mt-0.5" style={{ color: activeBudget.archived ? '#f59e0b' : 'var(--muted)' }}>
                {activeBudget.archived ? 'Archived' : isLocked ? 'Locked — read only' : 'Budget active'}
              </p>
            )}
          </div>

          <button
            onClick={() => store.setActiveBudgetMonth(shiftMonth(activeMonth, +1))}
            className="print:hidden rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Budget actions — only when a budget exists */}
        {activeBudget && (
          <div className="print:hidden flex items-center gap-1 px-3 pb-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => store.setBudgetLocked(activeMonth, !isLocked)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {isLocked ? <LockOpen size={12} /> : <Lock size={12} />}
              {isLocked ? 'Unlock' : 'Lock'}
            </button>
            <button
              onClick={() => store.setBudgetArchived(activeMonth, !activeBudget.archived)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {activeBudget.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
              {activeBudget.archived ? 'Unarchive' : 'Archive'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLocked}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              title={isLocked ? 'Unlock this budget to refresh it' : 'Refresh budget values'}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <ReportDownloadButton onClick={handleExportPdf} className="border-transparent px-2.5 py-1.5 text-xs font-medium" />
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ml-auto"
              style={{ color: '#f43f5e' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f43f5e18')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── No budget for this month ── */}
      {!activeBudget && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border"
          style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            No budget for {fmtMonth(activeMonth)}
          </p>
          <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
            Create one to start allocating income.
          </p>
          <button
            onClick={() => handleCreate(activeMonth)}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ background: 'var(--primary)', color: '#fff' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
          >
            <Plus size={14} />
            Create Budget for {fmtMonth(activeMonth)}
          </button>
        </div>
      )}

      {/* ── Budget content ── */}
      {activeBudget && calc && (
        <>
          <div className="pointer-events-none absolute left-[-10000px] top-0 w-[960px] opacity-0" aria-hidden="true">
            <BudgetExportDocument
              ref={exportRef}
              month={activeMonth}
              budgetStatus={activeBudget.archived ? 'Archived' : isLocked ? 'Locked' : 'Active'}
              calc={calc}
            />
          </div>

          {/* Summary strip */}
          <div className="mb-6 grid grid-cols-3 gap-2 print:hidden sm:gap-3">
            {[
              { label: 'Income',    value: fmtCurrency(calc.totals.income),    colour: 'var(--foreground)' },
              { label: 'Committed', value: fmtCurrency(calc.totals.allocated), colour: 'var(--foreground)' },
              { label: 'Balance',
                value:  (calc.totals.balance >= 0 ? '+' : '') + fmtCurrency(calc.totals.balance),
                colour: calc.totals.balance >= 0 ? '#10b981' : '#f43f5e',
              },
            ].map(({ label, value, colour }) => (
              <Tile
                key={label}
                title={label}
                value={value}
                align="center"
                size="sm"
                className="min-w-0"
                titleClassName="text-[11px] sm:text-xs"
                valueClassName="text-[clamp(0.8rem,3vw,1rem)] sm:text-[clamp(0.95rem,2.4vw,1.125rem)]"
                valueStyle={{ color: colour }}
              />
            ))}
          </div>

          {/* Over-allocation warnings */}
          {calc.sourceCalcs.some(sc => sc.isOverAllocated) && (
            <div className="mb-5 space-y-2 print:hidden">
              {calc.sourceCalcs.filter(sc => sc.isOverAllocated).map(sc => (
                <div key={sc.source.id}
                  className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: '#f59e0b44', background: '#f59e0b0d' }}>
                  <div>
                    <span className="font-medium text-amber-500">{sc.source.provider}</span>
                    <span className="ml-1" style={{ color: 'var(--muted)' }}>
                      — allocated {fmtCurrency(sc.allocated)} of {fmtCurrency(sc.income)} income
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-amber-500 ml-3">
                    +{fmtCurrency(sc.allocated - sc.income)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Pot list */}
          <div className="space-y-2 print:hidden">
            {visiblePotCalcs.map(({ pot, items }) => {
              const sourceCalcs  = getSourceCalcsForPot(calc, pot.id);
              const expenseItems = items.filter(i => i.sourceType === 'expense');
              const savingItems  = items.filter(i => i.sourceType === 'saving');
              return (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  expenses={expenseItems}
                  savings={savingItems}
                  sourceLabel={sourceLabelForCalcs(sourceCalcs)}
                  accentColor={accentColorForCalcs(sourceCalcs)}
                  sourceBreakdown={sourceBreakdownForCalcs(sourceCalcs)}
                  isOverAllocated={sourceCalcs.some(sourceCalc => sourceCalc.isOverAllocated)}
                  onClick={() => setSelectedPot(pot.id)}
                />
              );
            })}
          </div>

          {/* Pot drilldown drawer */}
          {selectedPotCalc && (
            <PotDrawer
              pot={selectedPotCalc.pot}
              items={selectedPotCalc.items}
              allPots={activePots}
              allSources={store.sources}
              sourceCalcs={selectedSourceCalcs}
              sourceLabel={sourceLabelForCalcs(selectedSourceCalcs)}
              locked={isLocked}
              open={!!selectedPotId}
              onClose={() => setSelectedPot(null)}
              onMoveToPot={handleMoveToPot}
              onMoveToIncomeSource={handleMoveToIncomeSource}
            />
          )}
        </>
      )}

      {/* New budget modal — pre-filled with the viewed month */}
      <NewBudgetModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
        existingMonths={store.budgets.map(b => b.month)}
        initialMonth={activeMonth}
      />

      {/* Archived budgets */}
      {archivedBudgets.length > 0 && (
        <div className="mt-6 print:hidden">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium mb-3"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived budgets ({archivedBudgets.length})
          </button>
          {showArchived && (
            <div className="space-y-2" style={{ opacity: 0.7 }}>
              {archivedBudgets.map(b => (
                <div key={b.month}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{fmtMonth(b.month)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {b.locked ? 'Locked · ' : ''}{b.items.length} items
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { store.setActiveBudgetMonth(b.month); store.setBudgetArchived(b.month, false); }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{ color: 'var(--muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <ArchiveRestore size={12} />
                      Restore
                    </button>
                    <button
                      onClick={() => store.deleteBudget(b.month)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                      style={{ color: '#f43f5e' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f43f5e18')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
