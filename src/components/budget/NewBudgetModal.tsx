'use client';

import { useState, useMemo, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import { resolveItemsForMonth } from '@/lib/budgetLogic';
import { useStore } from '@/lib/store';
import { fmtMonth } from '@/lib/format';

interface Props {
  open:           boolean;
  onClose:        () => void;
  onCreate:       (month: string) => void;
  existingMonths: string[];
  initialMonth?:  string;
}

function defaultMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function NewBudgetModal({ open, onClose, onCreate, existingMonths, initialMonth }: Props) {
  const store = useStore();
  const [month, setMonth] = useState(initialMonth ?? defaultMonth);

  useEffect(() => { if (open) setMonth(initialMonth ?? defaultMonth()); }, [open, initialMonth]);

  const preview = useMemo(() => {
    if (!month) return null;
    const items    = resolveItemsForMonth(month, store.expenses, store.savings);
    const expenses = items.filter(i => i.sourceType === 'expense');
    const savings  = items.filter(i => i.sourceType === 'saving');
    const total    = store.expenses.filter(e => !e.archived).length +
                     store.savings.filter(s => !s.archived).length;
    return { expenses, savings, included: items.length, excluded: total - items.length };
  }, [month, store.expenses, store.savings]);

  const isDuplicate = existingMonths.includes(month);

  function handleCreate() {
    if (!month) return;
    onCreate(month);
    onClose();
  }

  const title = (
    <div className="flex items-center gap-2">
      <CalendarDays size={16} style={{ color: 'var(--primary)' }} />
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>New Budget</h2>
    </div>
  );

  const footer = (
    <div className="flex gap-3 px-5 pt-3">
      <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        Cancel
      </button>
      <button onClick={handleCreate} disabled={!month || !preview || preview.included === 0}
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-40"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        Create Budget
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-5">
        {/* Month picker */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
            Budget month
          </label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors"
            style={{ background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const }} />
          {isDuplicate && (
            <p className="mt-1.5 text-xs text-amber-500">A budget for {fmtMonth(month)} already exists.</p>
          )}
        </div>

        {/* Live preview */}
        {preview && month && (
          <div className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              Preview — {fmtMonth(month)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3 text-center border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{preview.expenses.length}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Expenses</p>
              </div>
              <div className="rounded-lg p-3 text-center border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>{preview.savings.length}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Savings</p>
              </div>
            </div>
            {preview.excluded > 0 && (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {preview.excluded} item{preview.excluded !== 1 ? 's' : ''} excluded — outside date range.
              </p>
            )}
            {preview.included === 0 && (
              <p className="text-xs text-amber-500">No active items found for this month.</p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
