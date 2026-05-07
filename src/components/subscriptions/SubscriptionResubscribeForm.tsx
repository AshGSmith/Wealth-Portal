'use client';

import { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import type { ISODate, Subscription } from '@/lib/types';

interface Props {
  subscription: Subscription | null;
  open: boolean;
  onClose: () => void;
  onSave: (startDate: ISODate) => void;
}

const inputCls = 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors';
const inputStyle = {
  background: 'var(--surface-hover)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as const,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SubscriptionResubscribeForm({
  subscription,
  open,
  onClose,
  onSave,
}: Props) {
  const [startDate, setStartDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!startDate) {
      setError('Required');
      return;
    }
    onSave(startDate as ISODate);
    onClose();
  }

  const title = (
    <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
      Resubscribe
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
        Resubscribe
      </button>
    </div>
  );

  return (
    <Sheet open={open} onClose={onClose} title={title} footer={footer}>
      <div className="space-y-4 px-5 py-5">
        {subscription && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Reactivate {subscription.name} from a new payment date.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
            Start date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={event => {
              setStartDate(event.target.value);
              setError(null);
            }}
            className={inputCls}
            style={{ ...inputStyle, borderColor: error ? '#f43f5e' : 'var(--border)' }}
          />
          {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
        </div>
      </div>
    </Sheet>
  );
}
