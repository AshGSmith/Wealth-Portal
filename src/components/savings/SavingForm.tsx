'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { Saving, Pot, SavingId, PotId, IncomeSource, IncomeSourceId } from '@/lib/types';

interface Props {
  saving: Saving | null;
  pots: Pot[];
  sources: IncomeSource[];
  open: boolean;
  onClose: () => void;
  onSave: (saving: Saving) => void;
}

interface FormState {
  name:       string;
  amount:     string;
  potId:      string;
  incomeSourceId: string;
  startDate:  string;
  endDate:    string;
  isCritical: boolean;
}

function blank(pots: Pot[], sources: IncomeSource[]): FormState {
  return {
    name: '',
    amount: '',
    potId: pots.find(p => !p.archived)?.id ?? '',
    incomeSourceId: sources.find(source => !source.archived)?.id ?? '',
    startDate: '',
    endDate: '',
    isCritical: false,
  };
}
function fromSaving(s: Saving): FormState {
  return { name: s.name, amount: String(s.amount), potId: s.potId, incomeSourceId: s.incomeSourceId, startDate: s.startDate ?? '', endDate: s.endDate ?? '', isCritical: s.isCritical };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function SavingForm({ saving, pots, sources, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => saving ? fromSaving(saving) : blank(pots, sources));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim())            errs.name   = 'Required';
    if (!form.amount.trim())          errs.amount = 'Required';
    else if (Number(form.amount) <= 0) errs.amount = 'Must be > 0';
    if (!form.potId)                  errs.potId  = 'Required';
    if (!form.incomeSourceId)         errs.incomeSourceId = 'Required';
    if (form.startDate && form.endDate && form.endDate < form.startDate) errs.endDate = 'Must be after start date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:         saving?.id ?? (`s-${Date.now()}` as unknown as SavingId),
      name:       form.name.trim(),
      amount:     parseFloat(form.amount),
      potId:      form.potId as PotId,
      incomeSourceId: form.incomeSourceId as IncomeSourceId,
      startDate:  form.startDate || null,
      endDate:    form.endDate   || null,
      isCritical: form.isCritical,
      archived:   saving?.archived ?? false,
    });
    onClose();
  }

  const activePots = pots.filter(p => !p.archived);
  const activeSources = sources.filter(source => !source.archived);
  const isEditing  = !!saving;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {isEditing ? 'Edit Saving' : 'New Saving'}
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
        {isEditing ? 'Save Changes' : 'Add Saving'}
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
            placeholder="e.g. Emergency fund" className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Amount <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="0.00" className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amount ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
        </div>

        {/* Pot */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Pot <span className="text-rose-500">*</span>
          </label>
          <select value={form.potId} onChange={e => set('potId', e.target.value)} className={inputCls}
            style={{ ...inputStyle, borderColor: errors.potId ? '#f43f5e' : 'var(--border)' }}>
            <option value="" disabled>Select a pot…</option>
            {activePots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.potId && <p className="mt-1 text-xs text-rose-500">{errors.potId}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Income Source <span className="text-rose-500">*</span>
          </label>
          <select value={form.incomeSourceId} onChange={e => set('incomeSourceId', e.target.value)} className={inputCls}
            style={{ ...inputStyle, borderColor: errors.incomeSourceId ? '#f43f5e' : 'var(--border)' }}>
            <option value="" disabled>Select a source…</option>
            {activeSources.map(source => <option key={source.id} value={source.id}>{source.provider}</option>)}
          </select>
          {errors.incomeSourceId && <p className="mt-1 text-xs text-rose-500">{errors.incomeSourceId}</p>}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Start date <span style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              End date <span style={{ color: 'var(--muted)' }}>(optional)</span>
            </label>
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
              className={inputCls} style={{ ...inputStyle, borderColor: errors.endDate ? '#f43f5e' : 'var(--border)' }} />
            {errors.endDate && <p className="mt-1 text-xs text-rose-500">{errors.endDate}</p>}
          </div>
        </div>

        {/* isCritical */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.isCritical} onChange={e => set('isCritical', e.target.checked)}
            className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Critical saving</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Non-negotiable — always highlighted</p>
          </div>
        </label>
      </div>
    </Sheet>
  );
}
