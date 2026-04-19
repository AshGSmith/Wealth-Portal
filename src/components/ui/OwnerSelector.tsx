'use client';

import type { AccessibleUser } from '@/lib/auth/types';

export default function OwnerSelector({
  value,
  options,
  onChange,
}: {
  value: string[];
  options: AccessibleUser[];
  onChange: (nextValue: string[]) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
        Owners
      </label>
      <div className="space-y-2">
        {options.map(option => {
          const checked = value.includes(option.id);
          return (
            <label
              key={option.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={event => {
                  if (event.target.checked) {
                    onChange([...new Set([...value, option.id])]);
                    return;
                  }
                  onChange(value.filter(ownerId => ownerId !== option.id));
                }}
                className="h-4 w-4 rounded"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {option.name}
                </span>
                <span className="block truncate text-xs" style={{ color: 'var(--muted)' }}>
                  {option.email}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
        One owner means personal. Multiple owners means joint.
      </p>
    </div>
  );
}
