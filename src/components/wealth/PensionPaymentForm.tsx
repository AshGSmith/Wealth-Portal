'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { PensionId, PensionPayment, PensionPaymentId } from '@/lib/types';

interface Props {
  pensionId: PensionId | null;
  pensionName: string;
  open: boolean;
  onClose: () => void;
  onSave: (payment: PensionPayment) => void;
}

interface FormState {
  date: string;
  employeeEnabled: boolean;
  employerEnabled: boolean;
  employeeContribution: string;
  employerContribution: string;
  note: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blank(): FormState {
  return {
    date: todayIso(),
    employeeEnabled: true,
    employerEnabled: true,
    employeeContribution: '',
    employerContribution: '',
    note: '',
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function PensionPaymentForm({ pensionId, pensionName, open, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [employerTouched, setEmployerTouched] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function handleEmployeeChange(value: string) {
    setForm(prev => ({
      ...prev,
      employeeContribution: value,
      employerContribution: prev.employerEnabled && !employerTouched ? value : prev.employerContribution,
    }));
    setErrors(prev => ({ ...prev, employeeContribution: undefined, employerContribution: undefined }));
  }

  function handleEmployerToggle(enabled: boolean) {
    setForm(prev => ({
      ...prev,
      employerEnabled: enabled,
      employerContribution: enabled
        ? (employerTouched ? prev.employerContribution : prev.employeeContribution)
        : '',
    }));
    setErrors(prev => ({ ...prev, employerContribution: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.date) errs.date = 'Required';

    const employeeValue = form.employeeEnabled ? Number(form.employeeContribution || 0) : 0;
    const employerValue = form.employerEnabled ? Number(form.employerContribution || 0) : 0;

    if (!form.employeeEnabled && !form.employerEnabled) {
      errs.employeeContribution = 'Select at least one contribution type';
    }

    if (form.employeeEnabled && (form.employeeContribution.trim() === '' || employeeValue < 0)) {
      errs.employeeContribution = 'Enter a value of 0 or more';
    }

    if (form.employerEnabled && (form.employerContribution.trim() === '' || employerValue < 0)) {
      errs.employerContribution = 'Enter a value of 0 or more';
    }

    if (employeeValue <= 0 && employerValue <= 0) {
      errs.employeeContribution = errs.employeeContribution ?? 'Enter a contribution greater than 0';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!pensionId || !validate()) return;

    onSave({
      id: `pep-${Date.now()}` as unknown as PensionPaymentId,
      pensionId,
      date: form.date,
      employeeContribution: form.employeeEnabled ? Number(form.employeeContribution) : 0,
      employerContribution: form.employerEnabled ? Number(form.employerContribution) : 0,
      note: form.note.trim() || null,
    });
    onClose();
  }

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        Log Contribution
      </h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
        {pensionName}
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
        className="flex-1 rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        Add Contribution
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={event => set('date', event.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.date ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.date && <p className="mt-1 text-xs text-rose-500">{errors.date}</p>}
        </div>

        <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employee Contribution</span>
            <input
              type="checkbox"
              checked={form.employeeEnabled}
              onChange={event => set('employeeEnabled', event.target.checked)}
              className="h-4 w-4"
            />
          </label>
          {form.employeeEnabled && (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.employeeContribution}
                  onChange={event => handleEmployeeChange(event.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                  style={{ ...inputStyle, borderColor: errors.employeeContribution ? '#f43f5e' : 'var(--border)' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Employer Contribution</span>
            <input
              type="checkbox"
              checked={form.employerEnabled}
              onChange={event => handleEmployerToggle(event.target.checked)}
              className="h-4 w-4"
            />
          </label>
          {form.employerEnabled && (
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.employerContribution}
                  onChange={event => {
                    setEmployerTouched(true);
                    set('employerContribution', event.target.value);
                  }}
                  placeholder="0.00"
                  className={`${inputCls} pl-7`}
                  style={{ ...inputStyle, borderColor: errors.employerContribution ? '#f43f5e' : 'var(--border)' }}
                />
              </div>
              {!employerTouched && form.employeeEnabled && form.employeeContribution && (
                <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                  Defaulted to match the employee contribution.
                </p>
              )}
            </div>
          )}
        </div>

        {(errors.employeeContribution || errors.employerContribution) && (
          <p className="text-xs text-rose-500">
            {errors.employeeContribution ?? errors.employerContribution}
          </p>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Note
          </label>
          <textarea
            value={form.note}
            onChange={event => set('note', event.target.value)}
            rows={3}
            className={inputCls}
            style={inputStyle}
            placeholder="Optional context"
          />
        </div>
      </div>
    </Sheet>
  );
}
