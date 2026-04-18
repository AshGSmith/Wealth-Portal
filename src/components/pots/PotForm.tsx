'use client';

import { useState, useEffect } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { Pot, IncomeSource, PotId, IncomeSourceId } from '@/lib/types';

interface Props {
  pot:     Pot | null;
  sources: IncomeSource[];
  open:    boolean;
  onClose: () => void;
  onSave:  (pot: Pot) => void;
}

interface FormState { name: string; incomeSourceId: string; isBusiness: boolean; }

function blank(sources: IncomeSource[]): FormState { return { name: '', incomeSourceId: sources[0]?.id ?? '', isBusiness: false }; }
function fromPot(p: Pot): FormState { return { name: p.name, incomeSourceId: p.incomeSourceId, isBusiness: p.isBusiness ?? false }; }

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function PotForm({ pot, sources, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => pot ? fromPot(pot) : blank(sources));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (open) { setForm(pot ? fromPot(pot) : blank(sources)); setErrors({}); }
  }, [open, pot, sources]);

  const businessSources = sources.filter(s => s.type === 'business');
  const availableSources = form.isBusiness ? businessSources : sources;

  function handleBusinessToggle(checked: boolean) {
    setForm(prev => {
      const newSourceId = checked
        ? (businessSources[0]?.id ?? prev.incomeSourceId)
        : prev.incomeSourceId;
      return { ...prev, isBusiness: checked, incomeSourceId: newSourceId };
    });
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim())    errs.name           = 'Required';
    if (!form.incomeSourceId) errs.incomeSourceId = 'Required';
    if (form.isBusiness && businessSources.length === 0)
                              errs.incomeSourceId = 'No business income sources exist — add one first';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:             pot?.id ?? (`p-${Date.now()}` as unknown as PotId),
      name:           form.name.trim(),
      incomeSourceId: form.incomeSourceId as IncomeSourceId,
      isBusiness:     form.isBusiness,
      archived:       pot?.archived ?? false,
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
            onChange={e => handleBusinessToggle(e.target.checked)}
            className="h-4 w-4 rounded accent-[var(--primary)]"
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>Business Pot</span>
        </label>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Income source <span className="text-rose-500">*</span>
          </label>
          <select value={form.incomeSourceId} onChange={e => set('incomeSourceId', e.target.value)}
            disabled={form.isBusiness && businessSources.length <= 1}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.incomeSourceId ? '#f43f5e' : 'var(--border)',
              opacity: form.isBusiness && businessSources.length <= 1 ? 0.6 : 1 }}>
            <option value="" disabled>Select a source…</option>
            {availableSources.map(s => <option key={s.id} value={s.id}>{s.provider}</option>)}
          </select>
          {errors.incomeSourceId && <p className="mt-1 text-xs text-rose-500">{errors.incomeSourceId}</p>}
          {form.isBusiness && businessSources.length <= 1 && !errors.incomeSourceId && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              Locked to the only business source.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
