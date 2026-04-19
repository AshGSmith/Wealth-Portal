'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = {};

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
        {state?.errors?.password && <p className="mt-1 text-xs text-red-500">{state.errors.password[0]}</p>}
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Use at least 8 characters with upper and lower case letters and a number.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
        {state?.errors?.confirmPassword && <p className="mt-1 text-xs text-red-500">{state.errors.confirmPassword[0]}</p>}
      </div>

      {state?.message && (
        <p className="rounded-2xl border px-3 py-2.5 text-sm" style={{ borderColor: '#bfdbfe', background: '#eff6ff', color: '#1d4ed8' }}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        {pending ? 'Updating password...' : 'Update password'}
      </button>
    </form>
  );
}
