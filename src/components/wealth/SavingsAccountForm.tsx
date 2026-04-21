'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { SavingsAccount, SavingsAccountId } from '@/lib/types';

interface Props {
  account:        SavingsAccount | null;
  open:           boolean;
  onClose:        () => void;
  onSave:         (account: SavingsAccount) => void;
  ownerOptions:   AccessibleUser[];
  currentUserId:  string | null;
}

interface FormState {
  name:           string;
  currentBalance: string;
  targetSavingsAmount: string;
  interestRate:   string;
  ownerUserIds:   string[];
}

function blank(currentUserId: string | null): FormState {
  return { name: '', currentBalance: '', targetSavingsAmount: '', interestRate: '', ownerUserIds: currentUserId ? [currentUserId] : [] };
}

function fromAccount(a: SavingsAccount): FormState {
  return {
    name:           a.name,
    currentBalance: String(a.currentBalance),
    targetSavingsAmount: a.targetSavingsAmount !== null ? String(a.targetSavingsAmount) : '',
    interestRate:   String(a.interestRate * 100),
    ownerUserIds:   a.ownerUserIds,
  };
}

const inputCls   = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function SavingsAccountForm({ account, open, onClose, onSave, ownerOptions, currentUserId }: Props) {
  const [form,   setForm]   = useState<FormState>(() => account ? fromAccount(account) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())                         errs.name           = 'Required';
    if (form.ownerUserIds.length === 0)            errs.ownerUserIds   = 'Required';
    if (!form.currentBalance.trim())               errs.currentBalance = 'Required';
    else if (Number(form.currentBalance) < 0)      errs.currentBalance = 'Must be ≥ 0';
    if (form.targetSavingsAmount.trim() && Number(form.targetSavingsAmount) < 0) errs.targetSavingsAmount = 'Must be ≥ 0';
    if (!form.interestRate.trim())                 errs.interestRate   = 'Required';
    else if (Number(form.interestRate) < 0)        errs.interestRate   = 'Must be ≥ 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:             account?.id ?? (`sa-${Date.now()}` as unknown as SavingsAccountId),
      name:           form.name.trim(),
      currentBalance: parseFloat(form.currentBalance),
      targetSavingsAmount: form.targetSavingsAmount.trim() ? parseFloat(form.targetSavingsAmount) : null,
      interestRate:   parseFloat(form.interestRate) / 100,
      ownerUserIds:   form.ownerUserIds,
      archived:       account?.archived ?? false,
    });
    onClose();
  }

  const balanceChanged = account && parseFloat(form.currentBalance) !== account.currentBalance;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {account ? 'Edit Account' : 'New Account'}
    </h2>
  );

  const footer = (
    <div className="flex gap-3 px-5 pt-3">
      <button onClick={onClose}
        className="flex-1 rounded-lg border py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        Cancel
      </button>
      <button onClick={handleSave}
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        {account ? 'Save Changes' : 'Add Account'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">

        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Account name <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Marcus Easy Access"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Owners <span className="text-rose-500">*</span>
          </label>
          <OwnerSelector
            options={ownerOptions}
            value={form.ownerUserIds}
            onChange={value => set('ownerUserIds', value)}
          />
          {errors.ownerUserIds && <p className="mt-1 text-xs text-rose-500">{errors.ownerUserIds}</p>}
        </div>

        {/* Current balance */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Current balance <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.currentBalance}
              onChange={e => set('currentBalance', e.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.currentBalance ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.currentBalance && <p className="mt-1 text-xs text-rose-500">{errors.currentBalance}</p>}
          {balanceChanged && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Previous balance will be saved to history.
            </p>
          )}
        </div>

        {/* Interest rate */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Target savings amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.targetSavingsAmount}
              onChange={e => set('targetSavingsAmount', e.target.value)}
              placeholder="Optional"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.targetSavingsAmount ? '#f43f5e' : 'var(--border)' }} />
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Optional goal for this savings account.
          </p>
          {errors.targetSavingsAmount && <p className="mt-1 text-xs text-rose-500">{errors.targetSavingsAmount}</p>}
        </div>

        {/* Interest rate */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Interest rate <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input type="number" min="0" step="0.01" value={form.interestRate}
              onChange={e => set('interestRate', e.target.value)}
              placeholder="0.00"
              className={inputCls + ' pr-7'}
              style={{ ...inputStyle, borderColor: errors.interestRate ? '#f43f5e' : 'var(--border)' }} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>%</span>
          </div>
          {errors.interestRate && <p className="mt-1 text-xs text-rose-500">{errors.interestRate}</p>}
        </div>

      </div>
    </Sheet>
  );
}
