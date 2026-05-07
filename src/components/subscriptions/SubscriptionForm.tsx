'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type {
  IncomeSource,
  IncomeSourceId,
  ISODate,
  Pot,
  PotId,
  Subscription,
  SubscriptionCategory,
  SubscriptionCurrency,
  SubscriptionId,
  SubscriptionPaymentMethod,
  SubscriptionPaymentSchedule,
  SubscriptionStatus,
} from '@/lib/types';

const CURRENCIES: SubscriptionCurrency[] = ['GBP', 'USD'];
const SCHEDULES: SubscriptionPaymentSchedule[] = ['Weekly', 'Monthly', 'Yearly'];
const CATEGORIES: SubscriptionCategory[] = ['Streaming', 'Storage', 'Utility', 'Transport', 'Finance', 'Health', 'Business', 'Other'];
const STATUSES: SubscriptionStatus[] = ['Current', 'Cancelled'];
const PAYMENT_METHODS: SubscriptionPaymentMethod[] = ['Direct Debit', 'Card'];

interface Props {
  subscription: Subscription | null;
  pots: Pot[];
  sources: IncomeSource[];
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
  open: boolean;
  onClose: () => void;
  onSave: (subscription: Subscription) => void;
}

interface FormState {
  name: string;
  cost: string;
  currency: SubscriptionCurrency;
  paymentDate: string;
  paymentSchedule: SubscriptionPaymentSchedule;
  freeTrial: boolean;
  freeTrialExpiryDate: string;
  category: SubscriptionCategory;
  status: SubscriptionStatus;
  endDate: string;
  paymentMethod: SubscriptionPaymentMethod;
  potId: string;
  incomeSourceId: string;
  isCriticalExpense: boolean;
  ownerUserIds: string[];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  const targetDay = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() !== targetDay) next.setDate(0);
  return next;
}

function defaultEndDate(paymentDate: string, schedule: SubscriptionPaymentSchedule): string {
  const date = new Date(`${paymentDate || today()}T00:00:00`);
  if (schedule === 'Weekly') date.setDate(date.getDate() + 7);
  else if (schedule === 'Yearly') return addMonths(date, 12).toISOString().slice(0, 10);
  else return addMonths(date, 1).toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function blank(sources: IncomeSource[], currentUserId: string | null): FormState {
  return {
    name: '',
    cost: '',
    currency: 'GBP',
    paymentDate: today(),
    paymentSchedule: 'Monthly',
    freeTrial: false,
    freeTrialExpiryDate: '',
    category: 'Other',
    status: 'Current',
    endDate: '',
    paymentMethod: 'Card',
    potId: '',
    incomeSourceId: sources.find(source => !source.archived)?.id ?? '',
    isCriticalExpense: false,
    ownerUserIds: currentUserId ? [currentUserId] : [],
  };
}

function fromSubscription(subscription: Subscription): FormState {
  return {
    name: subscription.name,
    cost: String(subscription.cost),
    currency: subscription.currency,
    paymentDate: subscription.paymentDate,
    paymentSchedule: subscription.paymentSchedule,
    freeTrial: subscription.freeTrial,
    freeTrialExpiryDate: subscription.freeTrialExpiryDate ?? '',
    category: subscription.category,
    status: subscription.status,
    endDate: subscription.endDate ?? '',
    paymentMethod: subscription.paymentMethod,
    potId: subscription.potId,
    incomeSourceId: subscription.incomeSourceId,
    isCriticalExpense: subscription.isCriticalExpense,
    ownerUserIds: subscription.ownerUserIds,
  };
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

export default function SubscriptionForm({
  subscription,
  pots,
  sources,
  ownerOptions,
  currentUserId,
  open,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(() => subscription ? fromSubscription(subscription) : blank(sources, currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [endDateTouched, setEndDateTouched] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function setStatus(status: SubscriptionStatus) {
    setForm(prev => ({
      ...prev,
      status,
      endDate: status === 'Cancelled' ? prev.endDate || defaultEndDate(prev.paymentDate, prev.paymentSchedule) : '',
    }));
    setErrors(prev => ({ ...prev, status: undefined, endDate: undefined }));
  }

  function setPaymentDate(paymentDate: string) {
    setForm(prev => ({
      ...prev,
      paymentDate,
      endDate: prev.status === 'Cancelled' && !endDateTouched
        ? defaultEndDate(paymentDate, prev.paymentSchedule)
        : prev.endDate,
    }));
    setErrors(prev => ({ ...prev, paymentDate: undefined, endDate: undefined }));
  }

  function setPaymentSchedule(paymentSchedule: SubscriptionPaymentSchedule) {
    setForm(prev => ({
      ...prev,
      paymentSchedule,
      endDate: prev.status === 'Cancelled' && !endDateTouched
        ? defaultEndDate(prev.paymentDate, paymentSchedule)
        : prev.endDate,
    }));
    setErrors(prev => ({ ...prev, paymentSchedule: undefined, endDate: undefined }));
  }

  function validate(): boolean {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Required';
    if (!form.cost.trim()) nextErrors.cost = 'Required';
    else if (Number(form.cost) <= 0) nextErrors.cost = 'Must be > 0';
    if (!form.paymentDate) nextErrors.paymentDate = 'Required';
    if (form.status === 'Cancelled' && !form.endDate) nextErrors.endDate = 'Required';
    if (form.freeTrial && !form.freeTrialExpiryDate) nextErrors.freeTrialExpiryDate = 'Required';
    if (!form.potId) nextErrors.potId = 'Required';
    if (!form.incomeSourceId) nextErrors.incomeSourceId = 'Required';
    if (form.ownerUserIds.length === 0) nextErrors.ownerUserIds = 'Required';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    onSave({
      id: subscription?.id ?? (`sub-${Date.now()}` as unknown as SubscriptionId),
      name: form.name.trim(),
      cost: parseFloat(form.cost),
      currency: form.currency,
      paymentDate: form.paymentDate as ISODate,
      paymentSchedule: form.paymentSchedule,
      freeTrial: form.freeTrial,
      freeTrialExpiryDate: form.freeTrial ? (form.freeTrialExpiryDate as ISODate) : null,
      category: form.category,
      status: form.status,
      endDate: form.status === 'Cancelled' ? (form.endDate as ISODate) : null,
      paymentMethod: form.paymentMethod,
      potId: form.potId as PotId,
      incomeSourceId: form.incomeSourceId as IncomeSourceId,
      isCriticalExpense: form.isCriticalExpense,
      ownerUserIds: form.ownerUserIds,
      archived: subscription?.archived ?? false,
    });
    onClose();
  }

  const activePots = pots.filter(pot => !pot.archived);
  const activeSources = sources.filter(source => !source.archived);
  const isEditing = subscription !== null;

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {isEditing ? 'Edit Subscription' : 'New Subscription'}
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
        {isEditing ? 'Save Changes' : 'Add Subscription'}
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
            placeholder="e.g. Netflix"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }}
          />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Cost <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={event => set('cost', event.target.value)}
              placeholder="0.00"
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.cost ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.cost && <p className="mt-1 text-xs text-rose-500">{errors.cost}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Currency
            </label>
            <select value={form.currency} onChange={event => set('currency', event.target.value as SubscriptionCurrency)} className={inputCls} style={inputStyle}>
              {CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Payment date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.paymentDate}
              onChange={event => setPaymentDate(event.target.value)}
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.paymentDate ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.paymentDate && <p className="mt-1 text-xs text-rose-500">{errors.paymentDate}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Schedule
            </label>
            <select value={form.paymentSchedule} onChange={event => setPaymentSchedule(event.target.value as SubscriptionPaymentSchedule)} className={inputCls} style={inputStyle}>
              {SCHEDULES.map(schedule => <option key={schedule} value={schedule}>{schedule}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Category
            </label>
            <select value={form.category} onChange={event => set('category', event.target.value as SubscriptionCategory)} className={inputCls} style={inputStyle}>
              {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Status
            </label>
            <select value={form.status} onChange={event => setStatus(event.target.value as SubscriptionStatus)} className={inputCls} style={inputStyle}>
              {STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        </div>

        {form.status === 'Cancelled' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              End date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.endDate}
              onChange={event => {
                setEndDateTouched(true);
                set('endDate', event.target.value);
              }}
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.endDate ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.endDate && <p className="mt-1 text-xs text-rose-500">{errors.endDate}</p>}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Payment method
          </label>
          <select value={form.paymentMethod} onChange={event => set('paymentMethod', event.target.value as SubscriptionPaymentMethod)} className={inputCls} style={inputStyle}>
            {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Pot <span className="text-rose-500">*</span>
          </label>
          <select value={form.potId} onChange={event => set('potId', event.target.value)} className={inputCls} style={{ ...inputStyle, borderColor: errors.potId ? '#f43f5e' : 'var(--border)' }}>
            <option value="" disabled>Select a pot...</option>
            {activePots.map(pot => <option key={pot.id} value={pot.id}>{pot.name}</option>)}
          </select>
          {errors.potId && <p className="mt-1 text-xs text-rose-500">{errors.potId}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Income source <span className="text-rose-500">*</span>
          </label>
          <select value={form.incomeSourceId} onChange={event => set('incomeSourceId', event.target.value)} className={inputCls} style={{ ...inputStyle, borderColor: errors.incomeSourceId ? '#f43f5e' : 'var(--border)' }}>
            <option value="" disabled>Select a source...</option>
            {activeSources.map(source => <option key={source.id} value={source.id}>{source.provider}</option>)}
          </select>
          {errors.incomeSourceId && <p className="mt-1 text-xs text-rose-500">{errors.incomeSourceId}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.freeTrial}
            onChange={event => set('freeTrial', event.target.checked)}
            className="h-4 w-4 cursor-pointer rounded accent-blue-500"
          />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Free trial</span>
        </label>

        {form.freeTrial && (
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Free trial expiry <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={form.freeTrialExpiryDate}
              onChange={event => set('freeTrialExpiryDate', event.target.value)}
              className={inputCls}
              style={{ ...inputStyle, borderColor: errors.freeTrialExpiryDate ? '#f43f5e' : 'var(--border)' }}
            />
            {errors.freeTrialExpiryDate && <p className="mt-1 text-xs text-rose-500">{errors.freeTrialExpiryDate}</p>}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.isCriticalExpense}
            onChange={event => set('isCriticalExpense', event.target.checked)}
            className="h-4 w-4 cursor-pointer rounded accent-blue-500"
          />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Critical expense</span>
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
