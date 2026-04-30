'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type {
  InvestmentHoldingId,
  InvestmentValuationHistory,
  InvestmentValuationHistoryId,
  ISODate,
} from '@/lib/types';

interface Props {
  investmentId: InvestmentHoldingId | null;
  investmentName: string;
  open: boolean;
  onClose: () => void;
  onSave: (valuation: InvestmentValuationHistory) => void;
}

interface FormState {
  valuationDate: string;
  currentValue: string;
  note: string;
}

function blank(): FormState {
  return {
    valuationDate: new Date().toISOString().slice(0, 10),
    currentValue: '',
    note: '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

export default function InvestmentValuationForm({
  investmentId,
  investmentName,
  open,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  if (!investmentId) return null;
  const currentInvestmentId = investmentId;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.valuationDate) nextErrors.valuationDate = 'Required';
    if (!form.currentValue.trim()) nextErrors.currentValue = 'Required';
    else if (Number(form.currentValue) < 0) nextErrors.currentValue = 'Must be 0 or more';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    onSave({
      id: `inv-valuation-${Date.now()}` as unknown as InvestmentValuationHistoryId,
      investmentId: currentInvestmentId,
      valuationDate: form.valuationDate as ISODate,
      currentValue: parseFloat(form.currentValue),
      note: form.note.trim() || null,
    });

    onClose();
  }

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        Add Valuation
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
        {investmentName}
      </p>
    </div>
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
        Save Valuation
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Valuation Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.valuationDate}
            onChange={event => set('valuationDate', event.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.valuationDate ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.valuationDate && <p className="mt-1 text-xs text-rose-500">{errors.valuationDate}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Current Value <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.currentValue}
              onChange={event => set('currentValue', event.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.currentValue ? '#f43f5e' : 'var(--border)' }}
            />
          </div>
          {errors.currentValue && <p className="mt-1 text-xs text-rose-500">{errors.currentValue}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Note <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={form.note}
            onChange={event => set('note', event.target.value)}
            placeholder="e.g. End of month valuation"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </Sheet>
  );
}
