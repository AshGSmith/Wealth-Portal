'use client';

import { useEffect, useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type {
  InvestmentHoldingId,
  InvestmentPurchase,
  InvestmentPurchaseId,
  ISODate,
} from '@/lib/types';

interface Props {
  investmentId: InvestmentHoldingId | null;
  investmentName: string;
  open: boolean;
  onClose: () => void;
  onSave: (purchase: InvestmentPurchase) => void;
}

interface FormState {
  purchaseDate: string;
  amountInvested: string;
  sharesPurchased: string;
  note: string;
}

function blank(): FormState {
  return {
    purchaseDate: new Date().toISOString().slice(0, 10),
    amountInvested: '',
    sharesPurchased: '',
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

export default function InvestmentPurchaseForm({
  investmentId,
  investmentName,
  open,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(blank());
      setErrors({});
    }
  }, [open, investmentId]);

  if (!investmentId) return null;
  const currentInvestmentId = investmentId;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.purchaseDate) nextErrors.purchaseDate = 'Required';
    if (!form.amountInvested.trim()) nextErrors.amountInvested = 'Required';
    else if (Number(form.amountInvested) <= 0) nextErrors.amountInvested = 'Must be > 0';
    if (form.sharesPurchased.trim() && Number(form.sharesPurchased) <= 0) {
      nextErrors.sharesPurchased = 'Must be > 0';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    onSave({
      id: `inv-purchase-${Date.now()}` as unknown as InvestmentPurchaseId,
      investmentId: currentInvestmentId,
      purchaseDate: form.purchaseDate as ISODate,
      amountInvested: parseFloat(form.amountInvested),
      sharesPurchased: form.sharesPurchased.trim() ? parseFloat(form.sharesPurchased) : null,
      note: form.note.trim() || null,
    });

    onClose();
  }

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        Add Purchase
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
        Log Purchase
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Purchase Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.purchaseDate}
            onChange={event => set('purchaseDate', event.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.purchaseDate ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.purchaseDate && <p className="mt-1 text-xs text-rose-500">{errors.purchaseDate}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Amount Invested <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amountInvested}
              onChange={event => set('amountInvested', event.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amountInvested ? '#f43f5e' : 'var(--border)' }}
            />
          </div>
          {errors.amountInvested && <p className="mt-1 text-xs text-rose-500">{errors.amountInvested}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Shares Purchased <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={form.sharesPurchased}
            onChange={event => set('sharesPurchased', event.target.value)}
            placeholder="e.g. 12.3456"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.sharesPurchased ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.sharesPurchased && <p className="mt-1 text-xs text-rose-500">{errors.sharesPurchased}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Note <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={form.note}
            onChange={event => set('note', event.target.value)}
            placeholder="e.g. Monthly top-up"
            className={inputCls}
            style={inputStyle}
          />
        </div>
      </div>
    </Sheet>
  );
}
