'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { IncomeEntry, IncomeEntryId, IncomeSourceId } from '@/lib/types';

interface Props {
  entry:    IncomeEntry | null;
  sourceId: IncomeSourceId;
  open:     boolean;
  onClose:  () => void;
  onSave:   (entry: IncomeEntry) => void;
}

interface FormState {
  amount: string;
  date: string;
  endDate: string;
}

function blank(): FormState { return { amount: '', date: '', endDate: '' }; }
function fromEntry(e: IncomeEntry): FormState {
  return {
    amount: String(e.amount),
    date: e.date,
    endDate: e.endDate ?? '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function EntryForm({ entry, sourceId, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => entry ? fromEntry(entry) : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.amount.trim())           errs.amount = 'Required';
    else if (Number(form.amount) <= 0) errs.amount = 'Must be > 0';
    if (!form.date)                    errs.date   = 'Required';
    if (form.endDate && form.endDate < form.date) errs.endDate = 'Must be on or after Start Date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:             entry?.id ?? (`ie-${Date.now()}` as unknown as IncomeEntryId),
      incomeSourceId: sourceId,
      amount:         parseFloat(form.amount),
      date:           form.date,
      endDate:        form.endDate || null,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {entry ? 'Edit Entry' : 'New Entry'}
    </h2>
  );

  const footer = (
    <div className="flex gap-3 px-5 pt-3">
      <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        Cancel
      </button>
      <button onClick={handleSave} className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        {entry ? 'Save Changes' : 'Add Entry'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Amount <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amount ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Start Date <span className="text-rose-500">*</span>
          </label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.date ? '#f43f5e' : 'var(--border)' }} />
          {errors.date && <p className="mt-1 text-xs text-rose-500">{errors.date}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            End Date
          </label>
          <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.endDate ? '#f43f5e' : 'var(--border)' }} />
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Leave blank for ongoing income.
          </p>
          {errors.endDate && <p className="mt-1 text-xs text-rose-500">{errors.endDate}</p>}
        </div>
      </div>
    </Sheet>
  );
}
