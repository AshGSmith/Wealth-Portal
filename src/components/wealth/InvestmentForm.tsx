'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type {
  InvestmentHolding,
  InvestmentHoldingId,
  InvestmentPurchase,
  InvestmentPurchaseId,
  ISODate,
} from '@/lib/types';

interface Props {
  investment: InvestmentHolding | null;
  open: boolean;
  onClose: () => void;
  onSave: (payload: { investment: InvestmentHolding; initialPurchase?: InvestmentPurchase }) => void;
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
}

interface FormState {
  name: string;
  tickerOrSymbol: string;
  provider: string;
  ownerUserIds: string[];
  purchaseDate: string;
  amountInvested: string;
  sharesPurchased: string;
  note: string;
}

function blank(currentUserId: string | null): FormState {
  return {
    name: '',
    tickerOrSymbol: '',
    provider: '',
    ownerUserIds: currentUserId ? [currentUserId] : [],
    purchaseDate: new Date().toISOString().slice(0, 10),
    amountInvested: '',
    sharesPurchased: '',
    note: '',
  };
}

function fromInvestment(investment: InvestmentHolding): FormState {
  return {
    name: investment.name,
    tickerOrSymbol: investment.tickerOrSymbol,
    provider: investment.provider ?? '',
    ownerUserIds: investment.ownerUserIds,
    purchaseDate: new Date().toISOString().slice(0, 10),
    amountInvested: '',
    sharesPurchased: '',
    note: '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function InvestmentForm({ investment, open, onClose, onSave, ownerOptions, currentUserId }: Props) {
  const [form, setForm] = useState<FormState>(() => investment ? fromInvestment(investment) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Required';
    if (!form.tickerOrSymbol.trim()) nextErrors.tickerOrSymbol = 'Required';
    if (form.ownerUserIds.length === 0) nextErrors.ownerUserIds = 'Required';
    if (!investment) {
      if (!form.purchaseDate) nextErrors.purchaseDate = 'Required';
      if (!form.amountInvested.trim()) nextErrors.amountInvested = 'Required';
      else if (Number(form.amountInvested) <= 0) nextErrors.amountInvested = 'Must be > 0';
      if (form.sharesPurchased.trim() && Number(form.sharesPurchased) <= 0) nextErrors.sharesPurchased = 'Must be > 0';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const nextInvestment = {
      id: investment?.id ?? (`inv-${Date.now()}` as unknown as InvestmentHoldingId),
      name: form.name.trim(),
      tickerOrSymbol: form.tickerOrSymbol.trim(),
      provider: form.provider.trim() ? form.provider.trim() : null,
      ownerUserIds: form.ownerUserIds,
      archived: investment?.archived ?? false,
    };
    const initialPurchase = investment ? undefined : {
      id: `inv-purchase-${Date.now()}` as unknown as InvestmentPurchaseId,
      investmentId: nextInvestment.id,
      purchaseDate: form.purchaseDate as ISODate,
      amountInvested: parseFloat(form.amountInvested),
      sharesPurchased: form.sharesPurchased.trim() ? parseFloat(form.sharesPurchased) : null,
      note: form.note.trim() || null,
    };

    onSave({ investment: nextInvestment, initialPurchase });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {investment ? 'Edit Investment' : 'New Investment'}
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
        {investment ? 'Save Changes' : 'Add Investment'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={event => set('name', event.target.value)}
            placeholder="e.g. Vanguard FTSE Global All Cap"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Ticker or symbol <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.tickerOrSymbol}
            onChange={event => set('tickerOrSymbol', event.target.value)}
            placeholder="e.g. VWRP"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.tickerOrSymbol ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.tickerOrSymbol && <p className="mt-1 text-xs text-rose-500">{errors.tickerOrSymbol}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Provider / Platform
          </label>
          <input
            type="text"
            value={form.provider}
            onChange={event => set('provider', event.target.value)}
            placeholder="e.g. Vanguard, Hargreaves Lansdown"
            className={inputCls}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Owners <span className="text-rose-500">*</span>
          </label>
          <OwnerSelector
            options={ownerOptions}
            value={form.ownerUserIds}
            onChange={value => set('ownerUserIds', value)}
          />
          {errors.ownerUserIds && <p className="mt-1 text-xs text-rose-500">{errors.ownerUserIds}</p>}
        </div>

        {!investment && (
          <div className="space-y-4 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Initial Purchase
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                This creates the holding and its first purchase in one step.
              </p>
            </div>

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
                placeholder="e.g. Initial contribution"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
