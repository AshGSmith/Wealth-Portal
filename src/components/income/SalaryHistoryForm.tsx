'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { IncomeSourceId, SalaryHistory, SalaryHistoryId } from '@/lib/types';

interface Props {
  sourceId: IncomeSourceId;
  entry: SalaryHistory | null;
  open: boolean;
  onClose: () => void;
  onSave: (entry: SalaryHistory) => void;
}

interface FormState {
  annualSalary: string;
  effectiveDate: string;
  note: string;
}

function blank(): FormState {
  return { annualSalary: '', effectiveDate: '', note: '' };
}

function fromEntry(entry: SalaryHistory): FormState {
  return {
    annualSalary: String(entry.annualSalary),
    effectiveDate: entry.effectiveDate,
    note: entry.note ?? '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function SalaryHistoryForm({ sourceId, entry, open, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(() => entry ? fromEntry(entry) : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: typeof errors = {};
    if (!form.annualSalary.trim()) nextErrors.annualSalary = 'Required';
    else if (Number(form.annualSalary) <= 0) nextErrors.annualSalary = 'Must be > 0';
    if (!form.effectiveDate) nextErrors.effectiveDate = 'Required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id: entry?.id ?? (`salary-${Date.now()}` as unknown as SalaryHistoryId),
      incomeSourceId: sourceId,
      annualSalary: parseFloat(form.annualSalary),
      effectiveDate: form.effectiveDate,
      note: form.note.trim() || null,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {entry ? 'Edit Salary Change' : 'Add Salary Change'}
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
        {entry ? 'Save Changes' : 'Add Change'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Annual Salary <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.annualSalary} onChange={e => set('annualSalary', e.target.value)}
              placeholder="0.00" className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.annualSalary ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.annualSalary && <p className="mt-1 text-xs text-rose-500">{errors.annualSalary}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Effective Date <span className="text-rose-500">*</span>
          </label>
          <input type="date" value={form.effectiveDate} onChange={e => set('effectiveDate', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.effectiveDate ? '#f43f5e' : 'var(--border)' }} />
          {errors.effectiveDate && <p className="mt-1 text-xs text-rose-500">{errors.effectiveDate}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Note
          </label>
          <textarea
            value={form.note}
            onChange={e => set('note', e.target.value)}
            rows={3}
            placeholder="Optional note"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </Sheet>
  );
}
