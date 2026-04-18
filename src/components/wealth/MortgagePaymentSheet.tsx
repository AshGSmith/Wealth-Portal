'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import Sheet from '@/components/ui/Sheet';
import type { Mortgage, MortgagePayment, MortgagePaymentId } from '@/lib/types';
import { mortgageBalance } from '@/lib/wealthCalc';
import { fmtCurrency } from '@/lib/format';

interface Props {
  mortgage: Mortgage | null;
  payments: MortgagePayment[];
  open:     boolean;
  onClose:  () => void;
  onAdd:    (p: MortgagePayment) => void;
  onRemove: (id: string) => void;
}

interface FormState { amount: string; date: string; }

function blank(): FormState { return { amount: '', date: '' }; }

const inputCls   = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)', borderColor: 'var(--border)',
  color: 'var(--foreground)', colorScheme: 'dark' as const,
};

export default function MortgagePaymentSheet({ mortgage, payments, open, onClose, onAdd, onRemove }: Props) {
  const [form,   setForm]   = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => { if (open) { setForm(blank()); setErrors({}); } }, [open]);

  if (!mortgage) return null;

  const myPayments = [...payments]
    .filter(p => p.mortgageId === mortgage.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const outstanding = mortgageBalance(mortgage, payments);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.amount.trim())          errs.amount = 'Required';
    else if (Number(form.amount) <= 0) errs.amount = 'Must be > 0';
    if (!form.date)                   errs.date   = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAdd() {
    if (!validate() || !mortgage) return;
    onAdd({
      id:         `mp-${Date.now()}` as unknown as MortgagePaymentId,
      mortgageId: mortgage.id,
      amount:     parseFloat(form.amount),
      date:       form.date,
    });
    setForm(blank());
    setErrors({});
  }

  const title = (
    <div>
      <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
        {mortgage.lender} — Payments
      </h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
        Outstanding: <span style={{ color: 'var(--foreground)' }}>{fmtCurrency(outstanding)}</span>
      </p>
    </div>
  );

  const footer = (
    <div className="px-5 pt-3 space-y-3">
      {/* Log payment form */}
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        Log Payment
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--muted)' }}>£</span>
            <input type="number" min="0" step="0.01" value={form.amount}
              onChange={e => set('amount', e.target.value)}
              placeholder="0.00"
              className={inputCls + ' pl-7'}
              style={{ ...inputStyle, borderColor: errors.amount ? '#f43f5e' : 'var(--border)' }} />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
        </div>
        <div>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className={inputCls}
            style={{ ...inputStyle, borderColor: errors.date ? '#f43f5e' : 'var(--border)' }} />
          {errors.date && <p className="mt-1 text-xs text-rose-500">{errors.date}</p>}
        </div>
      </div>
      <button onClick={handleAdd}
        className="w-full rounded-lg py-2.5 text-sm font-semibold"
        style={{ background: 'var(--primary)', color: '#fff' }}>
        Add Payment
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      {myPayments.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
          No payments logged yet.
        </p>
      ) : (
        <>
          <div className="grid px-5 py-2 border-b text-[10px] font-semibold uppercase tracking-wide"
            style={{ borderColor: 'var(--border)', gridTemplateColumns: '1fr auto auto', color: 'var(--muted)' }}>
            <span>Date</span>
            <span className="text-right pr-4">Amount</span>
            <span />
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {myPayments.map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3 gap-3">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {fmtCurrency(p.amount)}
                </span>
                <button onClick={() => onRemove(p.id)}
                  className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }}
                  title="Remove"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
