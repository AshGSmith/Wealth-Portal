'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type {
  InvestmentHoldingId,
  InvestmentPerShareCurrency,
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
  perSharePrice: string;
  perShareCurrency: InvestmentPerShareCurrency;
  note: string;
}

function blank(): FormState {
  return {
    purchaseDate: new Date().toISOString().slice(0, 10),
    amountInvested: '',
    sharesPurchased: '',
    perSharePrice: '',
    perShareCurrency: 'GBP',
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!investmentId) return null;
  const currentInvestmentId = investmentId;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
    setSubmitError(null);
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.purchaseDate) nextErrors.purchaseDate = 'Required';
    if (!form.amountInvested.trim()) nextErrors.amountInvested = 'Required';
    else if (Number(form.amountInvested) <= 0) nextErrors.amountInvested = 'Must be > 0';
    if (form.sharesPurchased.trim() && Number(form.sharesPurchased) <= 0) {
      nextErrors.sharesPurchased = 'Must be > 0';
    }
    if (form.perSharePrice.trim() && Number(form.perSharePrice) <= 0) {
      nextErrors.perSharePrice = 'Must be > 0';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);

    let perSharePrice: number | null = null;
    let perShareCurrency: InvestmentPerShareCurrency | null = null;
    let perSharePriceGbp: number | null = null;
    let exchangeRateToGbp: number | null = null;
    let exchangeRateDate: ISODate | null = null;

    if (form.perSharePrice.trim()) {
      perSharePrice = parseFloat(form.perSharePrice);
      perShareCurrency = form.perShareCurrency;

      if (perShareCurrency === 'GBP') {
        perSharePriceGbp = perSharePrice;
        exchangeRateToGbp = 1;
        exchangeRateDate = form.purchaseDate as ISODate;
      } else {
        try {
          const response = await fetch('/api/exchange-rates/usd-gbp', { cache: 'no-store' });
          const data = await response.json() as { rateToGbp?: number; rateDate?: string; message?: string };
          if (!response.ok || !data.rateToGbp || !data.rateDate) {
            throw new Error(data.message ?? 'Exchange rate unavailable.');
          }
          exchangeRateToGbp = data.rateToGbp;
          exchangeRateDate = data.rateDate as ISODate;
          perSharePriceGbp = perSharePrice * exchangeRateToGbp;
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : 'Failed to fetch USD to GBP exchange rate.');
          setSubmitting(false);
          return;
        }
      }
    }

    onSave({
      id: `inv-purchase-${Date.now()}` as unknown as InvestmentPurchaseId,
      investmentId: currentInvestmentId,
      purchaseDate: form.purchaseDate as ISODate,
      amountInvested: parseFloat(form.amountInvested),
      sharesPurchased: form.sharesPurchased.trim() ? parseFloat(form.sharesPurchased) : null,
      perSharePrice,
      perShareCurrency,
      perSharePriceGbp,
      exchangeRateToGbp,
      exchangeRateDate,
      note: form.note.trim() || null,
    });

    setSubmitting(false);
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
        disabled={submitting}
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff', opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? 'Saving…' : 'Log Purchase'}
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

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Per-Share Price <span style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={form.perSharePrice}
              onChange={event => set('perSharePrice', event.target.value)}
              placeholder="e.g. 12.3456"
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.perSharePrice ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.perSharePrice && <p className="mt-1 text-xs text-rose-500">{errors.perSharePrice}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Currency
            </label>
            <select
              value={form.perShareCurrency}
              onChange={event => set('perShareCurrency', event.target.value as InvestmentPerShareCurrency)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
            </select>
          </div>
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

        {submitError && (
          <p className="text-xs text-rose-500">{submitError}</p>
        )}
      </div>
    </Sheet>
  );
}
