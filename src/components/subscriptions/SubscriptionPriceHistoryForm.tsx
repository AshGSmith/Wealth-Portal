'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type {
  ISODate,
  Subscription,
  SubscriptionCurrency,
  SubscriptionPriceHistory,
  SubscriptionPriceHistoryId,
} from '@/lib/types';

const CURRENCIES: SubscriptionCurrency[] = ['GBP', 'USD'];

interface Props {
  subscription: Subscription | null;
  open: boolean;
  onClose: () => void;
  onSave: (entry: SubscriptionPriceHistory) => void;
}

interface FormState {
  cost: string;
  currency: SubscriptionCurrency;
  effectiveDate: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

export default function SubscriptionPriceHistoryForm({ subscription, open, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(() => ({
    cost: subscription ? String(subscription.cost) : '',
    currency: subscription?.currency ?? 'GBP',
    effectiveDate: today(),
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function handleSave() {
    if (!subscription) return;

    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.cost.trim()) nextErrors.cost = 'Required';
    else if (Number(form.cost) <= 0) nextErrors.cost = 'Must be > 0';
    if (!form.effectiveDate) nextErrors.effectiveDate = 'Required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      id: `sub-price-${Date.now()}` as unknown as SubscriptionPriceHistoryId,
      subscriptionId: subscription.id,
      cost: parseFloat(form.cost),
      currency: form.currency,
      effectiveDate: form.effectiveDate as ISODate,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      Log Price Change
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
        Save Price
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            New cost <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.cost}
            onChange={event => set('cost', event.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.cost ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.cost && <p className="mt-1 text-xs text-rose-500">{errors.cost}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Currency
          </label>
          <select value={form.currency} onChange={event => set('currency', event.target.value as SubscriptionCurrency)} className={inputCls} style={inputStyle}>
            {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Effective date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={event => set('effectiveDate', event.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.effectiveDate ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.effectiveDate && <p className="mt-1 text-xs text-rose-500">{errors.effectiveDate}</p>}
        </div>
      </div>
    </Sheet>
  );
}
