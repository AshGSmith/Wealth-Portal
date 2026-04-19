'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Pot, PotId } from '@/lib/types';

interface Props {
  pot: Pot | null;
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
  onSave: (pot: Pot) => void;
}

interface FormState { name: string; isBusiness: boolean; ownerUserIds: string[]; }

function blank(currentUserId: string | null): FormState { return { name: '', isBusiness: false, ownerUserIds: currentUserId ? [currentUserId] : [] }; }
function fromPot(p: Pot): FormState { return { name: p.name, isBusiness: p.isBusiness ?? false, ownerUserIds: p.ownerUserIds }; }

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function PotForm({ pot, ownerOptions, currentUserId, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => pot ? fromPot(pot) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (form.ownerUserIds.length === 0) errs.ownerUserIds = 'Select at least one owner';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:         pot?.id ?? (`p-${Date.now()}` as unknown as PotId),
      name:       form.name.trim(),
      isBusiness: form.isBusiness,
      ownerUserIds: form.ownerUserIds,
      archived:   pot?.archived ?? false,
    });
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {pot ? 'Edit Pot' : 'New Pot'}
    </h2>
  );

  const footer = (
    <div className="flex gap-3 px-5 pt-3">
      <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 text-sm font-medium"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
        Cancel
      </button>
      <button onClick={handleSave} className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        {pot ? 'Save Changes' : 'Add Pot'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Name <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="e.g. Household" className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isBusiness}
            onChange={e => set('isBusiness', e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--primary)]"
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>Business Pot</span>
        </label>

        <OwnerSelector
          value={form.ownerUserIds}
          options={ownerOptions}
          onChange={value => set('ownerUserIds', value)}
        />
        {errors.ownerUserIds && <p className="mt-1 text-xs text-rose-500">{errors.ownerUserIds}</p>}
      </div>
    </Sheet>
  );
}
