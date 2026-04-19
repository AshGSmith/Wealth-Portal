'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Debt, DebtId, DebtType } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

interface Props {
  debt:           Debt | null;
  open:           boolean;
  onClose:        () => void;
  onSave:         (d: Debt) => void;
  ownerOptions:   AccessibleUser[];
  currentUserId:  string | null;
}

interface FormState {
  type:           DebtType;
  name:           string;
  provider:       string;
  borrowedAmount: string;
  currentBalance: string;
  interestRate:   string;
  termMonths:     string;
  startDate:      string;
  ownerUserIds:   string[];
}

function blank(currentUserId: string | null): FormState {
  return {
    type: 'loan',
    name: '',
    provider: '',
    borrowedAmount: '',
    currentBalance: '',
    interestRate: '',
    termMonths: '',
    startDate: '',
    ownerUserIds: currentUserId ? [currentUserId] : [],
  };
}

function fromDebt(d: Debt): FormState {
  return {
    type: d.debtType,
    name: d.name,
    provider: d.provider,
    borrowedAmount: d.borrowedAmount === null ? '' : String(d.borrowedAmount),
    currentBalance: String(d.currentBalance),
    interestRate: d.interestRate === 0 ? '' : String(d.interestRate * 100),
    termMonths: d.termMonths === null ? '' : String(d.termMonths),
    startDate: d.startDate ?? '',
    ownerUserIds: d.ownerUserIds,
  };
}

function calcEndDate(startDate: string, termMonths: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setMonth(d.getMonth() + termMonths);
  return d.toISOString().slice(0, 10);
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

export default function DebtForm({ debt, open, onClose, onSave, ownerOptions, currentUserId }: Props) {
  const [form, setForm] = useState<FormState>(() => debt ? fromDebt(debt) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  const isCreditCard = form.type === 'credit-card';

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) errs.name = 'Required';
    if (!form.provider.trim()) errs.provider = 'Required';
    if (form.ownerUserIds.length === 0) errs.ownerUserIds = 'Required';

    if (!form.currentBalance.trim()) errs.currentBalance = 'Required';
    else if (Number(form.currentBalance) < 0) errs.currentBalance = 'Must be ≥ 0';

    if (form.interestRate.trim() && Number(form.interestRate) < 0) errs.interestRate = 'Must be ≥ 0';
    if (!isCreditCard && !form.interestRate.trim()) errs.interestRate = 'Required';

    if (!isCreditCard) {
      if (!form.borrowedAmount.trim()) errs.borrowedAmount = 'Required';
      else if (Number(form.borrowedAmount) <= 0) errs.borrowedAmount = 'Must be > 0';

      if (!form.termMonths.trim()) errs.termMonths = 'Required';
      else if (!Number.isInteger(Number(form.termMonths)) || Number(form.termMonths) <= 0) errs.termMonths = 'Whole number > 0';

      if (!form.startDate) errs.startDate = 'Required';

      if (!errs.borrowedAmount && !errs.currentBalance && Number(form.currentBalance) > Number(form.borrowedAmount)) {
        errs.currentBalance = 'Cannot exceed borrowed amount';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    onSave({
      id: debt?.id ?? (`d-${Date.now()}` as unknown as DebtId),
      debtType: form.type,
      name: form.name.trim(),
      provider: form.provider.trim(),
      borrowedAmount: isCreditCard ? null : parseFloat(form.borrowedAmount),
      currentBalance: parseFloat(form.currentBalance),
      interestRate: form.interestRate.trim() ? parseFloat(form.interestRate) / 100 : 0,
      termMonths: isCreditCard ? null : parseInt(form.termMonths, 10),
      startDate: isCreditCard ? null : form.startDate,
      ownerUserIds: form.ownerUserIds,
      archived: debt?.archived ?? false,
    });
    onClose();
  }

  const endDate = !isCreditCard && form.startDate && form.termMonths && !errors.termMonths
    ? calcEndDate(form.startDate, parseInt(form.termMonths, 10))
    : null;
  const balanceChanged = debt && parseFloat(form.currentBalance) !== debt.currentBalance;
  const repaid = !isCreditCard && form.borrowedAmount && form.currentBalance
    ? Math.max(0, parseFloat(form.borrowedAmount) - parseFloat(form.currentBalance))
    : null;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {debt ? 'Edit Debt' : 'New Debt'}
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
        {debt ? 'Save Changes' : 'Add Debt'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Debt type <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value as DebtType)}
            className={inputCls}
            style={inputStyle}
          >
            <option value="loan">Loan</option>
            <option value="credit-card">Credit Card</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={isCreditCard ? 'e.g. Everyday Card' : 'e.g. Car finance'}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Provider <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.provider}
            onChange={e => set('provider', e.target.value)}
            placeholder="e.g. Monzo, Barclaycard"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.provider ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.provider && <p className="mt-1 text-xs text-rose-500">{errors.provider}</p>}
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

        <div className={`grid gap-3 ${isCreditCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!isCreditCard && (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Borrowed <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.borrowedAmount}
                  onChange={e => set('borrowedAmount', e.target.value)}
                  placeholder="0.00"
                  className={inputCls + ' pl-7'}
                  style={{ ...inputStyle, borderColor: errors.borrowedAmount ? '#f43f5e' : 'var(--border)' }}
                />
              </div>
              {errors.borrowedAmount && <p className="mt-1 text-xs text-rose-500">{errors.borrowedAmount}</p>}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Current balance <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.currentBalance}
                onChange={e => set('currentBalance', e.target.value)}
                placeholder="0.00"
                className={inputCls + ' pl-7'}
                style={{ ...inputStyle, borderColor: errors.currentBalance ? '#f43f5e' : 'var(--border)' }}
              />
            </div>
            {errors.currentBalance && <p className="mt-1 text-xs text-rose-500">{errors.currentBalance}</p>}
          </div>
        </div>

        {repaid !== null && repaid > 0 && !errors.borrowedAmount && !errors.currentBalance && (
          <p className="-mt-2 text-xs" style={{ color: '#10b981' }}>
            {fmtCurrency(repaid)} repaid so far
          </p>
        )}
        {balanceChanged && (
          <p className="-mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            Previous balance will be saved to history.
          </p>
        )}

        <div className={`grid gap-3 ${isCreditCard ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Interest rate {isCreditCard ? <span style={{ color: 'var(--muted)' }}>(optional)</span> : <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.interestRate}
                onChange={e => set('interestRate', e.target.value)}
                placeholder="0.00"
                className={inputCls + ' pr-7'}
                style={{ ...inputStyle, borderColor: errors.interestRate ? '#f43f5e' : 'var(--border)' }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>%</span>
            </div>
            {errors.interestRate && <p className="mt-1 text-xs text-rose-500">{errors.interestRate}</p>}
          </div>

          {!isCreditCard && (
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
                Term (months) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.termMonths}
                onChange={e => set('termMonths', e.target.value)}
                placeholder="e.g. 36"
                className={inputCls}
                style={{ ...inputStyle, borderColor: errors.termMonths ? '#f43f5e' : 'var(--border)' }}
              />
              {errors.termMonths && <p className="mt-1 text-xs text-rose-500">{errors.termMonths}</p>}
            </div>
          )}
        </div>

        {!isCreditCard && (
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Start date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => set('startDate', e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.startDate ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.startDate && <p className="mt-1 text-xs text-rose-500">{errors.startDate}</p>}
            {endDate && !errors.startDate && !errors.termMonths && (
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                End date: {new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
