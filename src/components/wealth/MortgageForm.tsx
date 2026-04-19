'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Mortgage, MortgageId } from '@/lib/types';

interface Props {
  mortgage: Mortgage | null;
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
  open:     boolean;
  onClose:  () => void;
  onSave:   (m: Mortgage) => void;
}

interface FormState {
  lender:          string;
  amountBorrowed:  string;
  interestRate:    string;
  termMonths:      string;
  startDate:       string;
  fixedTermMonths: string;
  ownerUserIds:    string[];
}

function blank(): FormState {
  return { lender: '', amountBorrowed: '', interestRate: '', termMonths: '', startDate: '', fixedTermMonths: '', ownerUserIds: [] };
}

function fromMortgage(m: Mortgage): FormState {
  return {
    lender:          m.lender,
    amountBorrowed:  String(m.amountBorrowed),
    interestRate:    String(m.interestRate * 100),
    termMonths:      String(m.termMonths),
    startDate:       m.startDate ?? '',
    fixedTermMonths: m.fixedTermMonths ? String(m.fixedTermMonths) : '',
    ownerUserIds:    m.ownerUserIds,
  };
}

const inputCls   = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function MortgageForm({ mortgage, ownerOptions, currentUserId, open, onClose, onSave }: Props) {
  const [form,   setForm]   = useState<FormState>(() => mortgage ? fromMortgage(mortgage) : { ...blank(), ownerUserIds: currentUserId ? [currentUserId] : [] });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.lender.trim())                           errs.lender         = 'Required';
    if (!form.amountBorrowed.trim())                   errs.amountBorrowed = 'Required';
    else if (Number(form.amountBorrowed) <= 0)         errs.amountBorrowed = 'Must be > 0';
    if (!form.interestRate.trim())                     errs.interestRate   = 'Required';
    else if (Number(form.interestRate) <= 0)           errs.interestRate   = 'Must be > 0';
    if (!form.termMonths.trim())                       errs.termMonths     = 'Required';
    else if (!Number.isInteger(Number(form.termMonths)) || Number(form.termMonths) <= 0)
                                                       errs.termMonths     = 'Must be a whole number > 0';
    if (form.ownerUserIds.length === 0)                errs.ownerUserIds   = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:              mortgage?.id ?? (`m-${Date.now()}` as unknown as MortgageId),
      lender:          form.lender.trim(),
      amountBorrowed:  parseFloat(form.amountBorrowed),
      interestRate:    parseFloat(form.interestRate) / 100,
      termMonths:      parseInt(form.termMonths, 10),
      startDate:       form.startDate || null,
      fixedTermMonths: form.fixedTermMonths.trim() ? parseInt(form.fixedTermMonths, 10) : null,
      ownerUserIds:    form.ownerUserIds,
      archived:        mortgage?.archived ?? false,
    });
    onClose();
  }

  const termYears = form.termMonths ? (parseInt(form.termMonths) / 12).toFixed(1) : null;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {mortgage ? 'Edit Mortgage' : 'New Mortgage'}
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
        {mortgage ? 'Save Changes' : 'Add Mortgage'}
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="px-5 py-5 space-y-4">

        {/* Lender */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Lender <span className="text-rose-500">*</span>
          </label>
          <input type="text" value={form.lender} onChange={e => set('lender', e.target.value)}
            placeholder="e.g. Nationwide, Halifax"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.lender ? '#f43f5e' : 'var(--border)' }} />
          {errors.lender && <p className="mt-1 text-xs text-rose-500">{errors.lender}</p>}
        </div>

        {/* Start date */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Start date
          </label>
          <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, colorScheme: 'dark' }} />
        </div>

        {/* Amount borrowed */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Amount borrowed <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="1" value={form.amountBorrowed}
              onChange={e => set('amountBorrowed', e.target.value)}
              placeholder="0"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amountBorrowed ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.amountBorrowed && <p className="mt-1 text-xs text-rose-500">{errors.amountBorrowed}</p>}
        </div>

        {/* Fixed term */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Fixed term (months)
          </label>
          <input type="number" min="1" step="1" value={form.fixedTermMonths}
            onChange={e => set('fixedTermMonths', e.target.value)}
            placeholder="e.g. 24 — leave blank if variable"
            className={inputCls}
            style={inputStyle} />
          {form.fixedTermMonths.trim() && !isNaN(Number(form.fixedTermMonths)) && (
            <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
              {(parseInt(form.fixedTermMonths) / 12).toFixed(1)} years fixed
            </p>
          )}
        </div>

        {/* Interest rate / Term */}
        <div className="grid grid-cols-2 gap-3">
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

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Term (months) <span className="text-rose-500">*</span>
            </label>
            <input type="number" min="1" step="1" value={form.termMonths}
              onChange={e => set('termMonths', e.target.value)}
              placeholder="e.g. 300"
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.termMonths ? '#f43f5e' : 'var(--border)' }} />
            {termYears && !errors.termMonths && (
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{termYears} years</p>
            )}
            {errors.termMonths && <p className="mt-1 text-xs text-rose-500">{errors.termMonths}</p>}
          </div>
        </div>

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
