'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Pension, PensionId } from '@/lib/types';

interface Props {
  pension:        Pension | null;
  open:           boolean;
  onClose:        () => void;
  onSave:         (p: Pension) => void;
  ownerOptions:   AccessibleUser[];
  currentUserId:  string | null;
}

interface FormState {
  name:           string;
  provider:       string;
  currentBalance: string;
  ownerUserIds:   string[];
}

function blank(currentUserId: string | null): FormState {
  return { name: '', provider: '', currentBalance: '', ownerUserIds: currentUserId ? [currentUserId] : [] };
}

function fromPension(p: Pension): FormState {
  return {
    name:           p.name,
    provider:       p.provider,
    currentBalance: String(p.currentBalance),
    ownerUserIds:   p.ownerUserIds,
  };
}

const inputCls   = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function PensionForm({ pension, open, onClose, onSave, ownerOptions, currentUserId }: Props) {
  const [form,   setForm]   = useState<FormState>(() => pension ? fromPension(pension) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())                       errs.name           = 'Required';
    if (!form.provider.trim())                   errs.provider       = 'Required';
    if (form.ownerUserIds.length === 0)          errs.ownerUserIds   = 'Required';
    if (!form.currentBalance.trim())             errs.currentBalance = 'Required';
    else if (Number(form.currentBalance) < 0)    errs.currentBalance = 'Must be ≥ 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:             pension?.id ?? (`pe-${Date.now()}` as unknown as PensionId),
      name:           form.name.trim(),
      provider:       form.provider.trim(),
      currentBalance: parseFloat(form.currentBalance),
      ownerUserIds:   form.ownerUserIds,
      archived:       pension?.archived ?? false,
    });
    onClose();
  }

  const balanceChanged = pension && parseFloat(form.currentBalance) !== pension.currentBalance;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {pension ? 'Edit Pension' : 'New Pension'}
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
        {pension ? 'Save Changes' : 'Add Pension'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">

        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Workplace Pension"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        {/* Provider */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Provider <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.provider} onChange={e => set('provider', e.target.value)}
            placeholder="e.g. Nest, Vanguard"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.provider ? '#f43f5e' : 'var(--border)' }} />
          {errors.provider && <p className="mt-1 text-xs text-rose-500">{errors.provider}</p>}
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
              placeholder="0.00" className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.currentBalance ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.currentBalance && <p className="mt-1 text-xs text-rose-500">{errors.currentBalance}</p>}
          {balanceChanged && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Previous balance will be saved to history.
            </p>
          )}
        </div>

      </div>
    </Sheet>
  );
}
