'use client';

import { useEffect, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { Debt, DebtTransaction, DebtTransactionId, DebtTransactionType, ISODate } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

interface Props {
  debt: Debt | null;
  mode: DebtTransactionType;
  open: boolean;
  onClose: () => void;
  onApply: (transaction: DebtTransaction) => void;
}

interface FormState {
  amount: string;
  date: string;
  note: string;
}

function blank(): FormState {
  return { amount: '', date: new Date().toISOString().slice(0, 10), note: '' };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

export default function DebtTransactionSheet({ debt, mode, open, onClose, onApply }: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) { setForm(blank()); setErrors({}); }
  }, [open, mode]);

  if (!debt) return null;
  const currentDebt = debt;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.amount.trim()) errs.amount = 'Required';
    else if (Number(form.amount) <= 0) errs.amount = 'Must be > 0';
    else if (mode === 'payment' && Number(form.amount) > currentDebt.currentBalance) errs.amount = 'Cannot exceed current balance';
    if (!form.date) errs.date = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleApply() {
    if (!validate()) return;
    const amount = parseFloat(form.amount);
    onApply({
      id: `dt-${Date.now()}` as unknown as DebtTransactionId,
      debtId: currentDebt.id,
      type: mode,
      amount,
      note: form.note.trim() || null,
      date: form.date as ISODate,
    });

    onClose();
  }

  const actionLabel = mode === 'purchase' ? 'New Purchase' : 'Payment';
  const nextBalance = form.amount && Number(form.amount) > 0
    ? mode === 'purchase'
      ? currentDebt.currentBalance + Number(form.amount)
      : Math.max(0, currentDebt.currentBalance - Number(form.amount))
    : currentDebt.currentBalance;

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {currentDebt.name} — {actionLabel}
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
        Current balance: <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(currentDebt.currentBalance)}</span>
      </p>
    </div>
  );

  const footer = (
    <div className="space-y-3 px-5 pt-3">
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        New balance: <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(nextBalance)}</span>
      </p>
      <button
        onClick={handleApply}
        className="w-full rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        Log {actionLabel}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
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
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.date ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.date && <p className="mt-1 text-xs text-rose-500">{errors.date}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Note <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={form.note}
            onChange={e => set('note', e.target.value)}
            placeholder={mode === 'purchase' ? 'e.g. Groceries' : 'e.g. Manual payment'}
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </Sheet>
  );
}
