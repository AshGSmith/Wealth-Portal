'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Expense, Pot, ExpenseId, PotId, IncomeSource, IncomeSourceId } from '@/lib/types';

interface Props {
  expense: Expense | null;
  pots: Pot[];
  sources: IncomeSource[];
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
}

interface FormState {
  name:       string;
  amount:     string;
  potId:      string;
  incomeSourceId: string;
  startDate:  string;
  endDate:    string;
  isCritical: boolean;
  oneOffPayment: boolean;
  ownerUserIds: string[];
}

function blank(pots: Pot[], sources: IncomeSource[], currentUserId: string | null): FormState {
  return {
    name: '',
    amount: '',
    potId: pots.find(p => !p.archived)?.id ?? '',
    incomeSourceId: sources.find(source => !source.archived)?.id ?? '',
    startDate: '',
    endDate: '',
    isCritical: false,
    oneOffPayment: false,
    ownerUserIds: currentUserId ? [currentUserId] : [],
  };
}
function fromExpense(e: Expense): FormState {
  return {
    name: e.name,
    amount: String(e.amount),
    potId: e.potId,
    incomeSourceId: e.incomeSourceId,
    startDate: e.startDate ?? '',
    endDate: e.endDate ?? '',
    isCritical: e.isCritical,
    oneOffPayment: e.oneOffPayment,
    ownerUserIds: e.ownerUserIds,
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--surface-hover)', borderColor: 'var(--border)', color: 'var(--foreground)', colorScheme: 'dark' as const };

export default function ExpenseForm({ expense, pots, sources, ownerOptions, currentUserId, open, onClose, onSave }: Props) {
  const [form, setForm]     = useState<FormState>(() => expense ? fromExpense(expense) : blank(pots, sources, currentUserId));
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
    if (form.ownerUserIds.length === 0) errs.ownerUserIds = 'Required';
    if (form.startDate && form.endDate && form.endDate < form.startDate) errs.endDate = 'Must be after start date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:         expense?.id ?? (`e-${Date.now()}` as unknown as ExpenseId),
      name:       form.name.trim(),
      amount:     parseFloat(form.amount),
      potId:      form.potId as PotId,
      incomeSourceId: form.incomeSourceId as IncomeSourceId,
      ownerUserIds: form.ownerUserIds,
      startDate:  form.startDate || null,
      endDate:    form.endDate   || null,
      isCritical: form.isCritical,
      oneOffPayment: form.oneOffPayment,
      oneOffAppliedBudgetMonth: form.oneOffPayment ? expense?.oneOffAppliedBudgetMonth ?? null : null,
      archived:   expense?.archived ?? false,
    });
    onClose();
  }

  const activePots = pots.filter(p => !p.archived);
  const activeSources = sources.filter(source => !source.archived);
  const isEditing  = !!expense;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {isEditing ? 'Edit Expense' : 'New Expense'}
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
        {isEditing ? 'Save Changes' : 'Add Expense'}
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
            placeholder="e.g. Rent" className={inputCls}
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
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Critical expense</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Non-negotiable — always highlighted</p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.oneOffPayment} onChange={e => set('oneOffPayment', e.target.checked)}
            className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>One off payment</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Apply this expense to one budget only, then stop including it in future budgets
            </p>
          </div>
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
