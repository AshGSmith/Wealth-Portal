'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { SavingAmountHistory, SavingAmountHistoryId, SavingId } from '@/lib/types';

interface Props {
  savingId: SavingId;
  entry: SavingAmountHistory | null;
  open: boolean;
  onClose: () => void;
  onSave: (entry: SavingAmountHistory) => void;
}

interface FormState {
  amount: string;
  effectiveDate: string;
}

function blank(): FormState {
  return { amount: '', effectiveDate: '' };
}

function fromEntry(entry: SavingAmountHistory): FormState {
  return {
    amount: String(entry.amount),
    effectiveDate: entry.effectiveDate,
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function SavingAmountHistoryForm({ savingId, entry, open, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(() => entry ? fromEntry(entry) : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: typeof errors = {};
    if (!form.amount.trim()) nextErrors.amount = 'Required';
    else if (Number(form.amount) <= 0) nextErrors.amount = 'Must be > 0';
    if (!form.effectiveDate) nextErrors.effectiveDate = 'Required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id: entry?.id ?? (`saving-amount-${Date.now()}` as unknown as SavingAmountHistoryId),
      savingId,
      amount: parseFloat(form.amount),
      effectiveDate: form.effectiveDate,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {entry ? 'Edit Amount Change' : 'Add Amount Change'}
    </h2>
  );

  const footer = (
    <div className="flex gap-3 px-5 pt-3">
      <button
        onClick={onClose}
        className="flex-1 rounded-lg border py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        {entry ? 'Save Changes' : 'Add Change'}
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
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amount ? '#f43f5e' : 'var(--border)' }}
            />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Effective Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={e => set('effectiveDate', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.effectiveDate ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.effectiveDate && <p className="mt-1 text-xs text-rose-500">{errors.effectiveDate}</p>}
        </div>
      </div>
    </Sheet>
  );
}
