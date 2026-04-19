'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import OwnerSelector from '@/components/ui/OwnerSelector';
import type { AccessibleUser } from '@/lib/auth/types';
import type { Property, Mortgage, PropertyId, MortgageId } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

interface Props {
  property:  Property | null;
  mortgages: Mortgage[];
  ownerOptions: AccessibleUser[];
  currentUserId: string | null;
  open:      boolean;
  onClose:   () => void;
  onSave:    (p: Property) => void;
}

interface FormState {
  name:            string;
  address:         string;
  purchaseDate:    string;
  purchasePrice:   string;
  currentValue:    string;
  mortgageId:      string;
  isMainResidence: boolean;
  isRental:        boolean;
  ownerUserIds:    string[];
}

function blank(currentUserId: string | null): FormState {
  return {
    name: '', address: '', purchaseDate: '', purchasePrice: '',
    currentValue: '', mortgageId: '', isMainResidence: false, isRental: false,
    ownerUserIds: currentUserId ? [currentUserId] : [],
  };
}

function fromProperty(p: Property): FormState {
  return {
    name:            p.name,
    address:         p.address,
    purchaseDate:    p.purchaseDate,
    purchasePrice:   String(p.purchasePrice),
    currentValue:    String(p.currentValue),
    mortgageId:      p.mortgageId ?? '',
    isMainResidence: p.isMainResidence,
    isRental:        p.isRental,
    ownerUserIds:    p.ownerUserIds,
  };
}

const inputCls   = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function PropertyForm({ property, mortgages, ownerOptions, currentUserId, open, onClose, onSave }: Props) {
  const [form,   setForm]   = useState<FormState>(() => property ? fromProperty(property) : blank(currentUserId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  // Auto-fill address from name when creating a new property
  function handleNameChange(value: string) {
    setForm(prev => ({
      ...prev,
      name: value,
      address: !property && !prev.address ? value : prev.address,
    }));
    setErrors(prev => ({ ...prev, name: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())                         errs.name          = 'Required';
    if (!form.address.trim())                      errs.address       = 'Required';
    if (!form.purchaseDate)                        errs.purchaseDate  = 'Required';
    if (!form.purchasePrice.trim())                errs.purchasePrice = 'Required';
    else if (Number(form.purchasePrice) <= 0)      errs.purchasePrice = 'Must be > 0';
    if (!form.currentValue.trim())                 errs.currentValue  = 'Required';
    else if (Number(form.currentValue) <= 0)       errs.currentValue  = 'Must be > 0';
    if (form.ownerUserIds.length === 0)            errs.ownerUserIds  = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      id:              property?.id ?? (`pr-${Date.now()}` as unknown as PropertyId),
      name:            form.name.trim(),
      address:         form.address.trim(),
      purchaseDate:    form.purchaseDate,
      purchasePrice:   parseFloat(form.purchasePrice),
      currentValue:    parseFloat(form.currentValue),
      mortgageId:      form.mortgageId ? (form.mortgageId as unknown as MortgageId) : null,
      isMainResidence: form.isMainResidence,
      isRental:        form.isRental,
      ownerUserIds:    form.ownerUserIds,
      archived:        property?.archived ?? false,
    });
    onClose();
  }

  const activeMortgages = mortgages.filter(m => !m.archived);

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      {property ? 'Edit Property' : 'New Property'}
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
        {property ? 'Save Changes' : 'Add Property'}
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
          <input type="text" value={form.name} onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Home, Buy-to-let flat"
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.name ? '#f43f5e' : 'var(--border)' }} />
          {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Address <span className="text-rose-500">*</span>
          </label>
          <textarea value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="Full address"
            rows={2}
            className={inputCls + ' resize-none'}
            style={{ ...inputStyle, borderColor: errors.address ? '#f43f5e' : 'var(--border)' }} />
          {errors.address && <p className="mt-1 text-xs text-rose-500">{errors.address}</p>}
        </div>

        {/* Purchase date */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Purchase date <span className="text-rose-500">*</span>
          </label>
          <input type="date" value={form.purchaseDate} onChange={e => set('purchaseDate', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.purchaseDate ? '#f43f5e' : 'var(--border)' }} />
          {errors.purchaseDate && <p className="mt-1 text-xs text-rose-500">{errors.purchaseDate}</p>}
        </div>

        {/* Purchase price / Current value */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Purchase price <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
              <input type="number" min="0" step="1" value={form.purchasePrice}
                onChange={e => set('purchasePrice', e.target.value)}
                placeholder="0"
                className={inputCls + ' pl-7'}
                style={{ ...inputStyle, borderColor: errors.purchasePrice ? '#f43f5e' : 'var(--border)' }} />
            </div>
            {errors.purchasePrice && <p className="mt-1 text-xs text-rose-500">{errors.purchasePrice}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Current value <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
              <input type="number" min="0" step="1" value={form.currentValue}
                onChange={e => set('currentValue', e.target.value)}
                placeholder="0"
                className={inputCls + ' pl-7'}
                style={{ ...inputStyle, borderColor: errors.currentValue ? '#f43f5e' : 'var(--border)' }} />
            </div>
            {errors.currentValue && <p className="mt-1 text-xs text-rose-500">{errors.currentValue}</p>}
          </div>
        </div>

        {/* Gain/loss preview */}
        {form.purchasePrice && form.currentValue && Number(form.purchasePrice) > 0 && Number(form.currentValue) > 0 && (() => {
          const gain = parseFloat(form.currentValue) - parseFloat(form.purchasePrice);
          const pct  = (gain / parseFloat(form.purchasePrice)) * 100;
          const pos  = gain >= 0;
          return (
            <p className="text-xs -mt-2" style={{ color: pos ? '#10b981' : '#f43f5e' }}>
              {pos ? '+' : ''}{fmtCurrency(gain)} ({pos ? '+' : ''}{pct.toFixed(1)}%) since purchase
            </p>
          );
        })()}

        {/* Mortgage */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
            Mortgage <span style={{ color: 'var(--muted)' }}>(optional)</span>
          </label>
          <select value={form.mortgageId} onChange={e => set('mortgageId', e.target.value)}
            className={inputCls} style={inputStyle}>
            <option value="">No mortgage</option>
            {activeMortgages.map(m => (
              <option key={m.id} value={m.id}>{m.lender}</option>
            ))}
          </select>
        </div>

        {/* Flags */}
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isMainResidence}
              onChange={e => set('isMainResidence', e.target.checked)}
              className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Main residence</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Your primary home</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.isRental}
              onChange={e => set('isRental', e.target.checked)}
              className="h-4 w-4 rounded accent-blue-500 cursor-pointer" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Rental property</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Generates rental income</p>
            </div>
          </label>
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
