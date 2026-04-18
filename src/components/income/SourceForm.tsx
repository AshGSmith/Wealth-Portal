'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { IncomeSource, IncomeSourceId } from '@/lib/types';
import { INCOME_SOURCE_TYPES, type IncomeSourceType } from '@/lib/constants';
import { fmtSourceType } from '@/lib/format';

interface Props {
  source:  IncomeSource | null;
  open:    boolean;
  onClose: () => void;
  onSave:  (source: IncomeSource) => void;
}


interface FormState { provider: string; type: IncomeSourceType; startingAnnualSalary: string; }

function blank(): FormState { return { provider: '', type: 'salary', startingAnnualSalary: '' }; }
function fromSource(s: IncomeSource): FormState {
  return {
    provider: s.provider,
    type: s.type,
    startingAnnualSalary: s.startingAnnualSalary !== null ? String(s.startingAnnualSalary) : '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function SourceForm({ source, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => source ? fromSource(source) : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.provider.trim()) errs.provider = 'Required';
    if (form.type === 'salary' && form.startingAnnualSalary.trim() && Number(form.startingAnnualSalary) <= 0) {
      errs.startingAnnualSalary = 'Must be > 0';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:       source?.id ?? (`is-${Date.now()}` as unknown as IncomeSourceId),
      provider:             form.provider.trim(),
      type:                 form.type,
      startingAnnualSalary: form.type === 'salary' && form.startingAnnualSalary.trim()
        ? parseFloat(form.startingAnnualSalary)
        : null,
      archived:             source?.archived ?? false,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {source ? 'Edit Source' : 'New Source'}
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
        {source ? 'Save Changes' : 'Add Source'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Provider <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.provider} onChange={e => set('provider', e.target.value)}
            placeholder="e.g. Civica" className={inputCls}
            style={{ ...inputStyle, borderColor: errors.provider ? '#f43f5e' : 'var(--border)' }} />
          {errors.provider && <p className="mt-1 text-xs text-rose-500">{errors.provider}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Type <span className="text-rose-500">*</span>
          </label>
          <select value={form.type} onChange={e => set('type', e.target.value as IncomeSourceType)}
            className={inputCls} style={inputStyle}>
            {INCOME_SOURCE_TYPES.map(t => <option key={t} value={t}>{fmtSourceType(t)}</option>)}
          </select>
        </div>

        {form.type === 'salary' && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Starting Annual Salary
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.startingAnnualSalary}
                onChange={e => set('startingAnnualSalary', e.target.value)}
                placeholder="0.00"
                className={inputCls + ' pl-7'}
                style={{ ...inputStyle, borderColor: errors.startingAnnualSalary ? '#f43f5e' : 'var(--border)' }}
              />
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Optional starting point for salary tracking.
            </p>
            {errors.startingAnnualSalary && <p className="mt-1 text-xs text-rose-500">{errors.startingAnnualSalary}</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
