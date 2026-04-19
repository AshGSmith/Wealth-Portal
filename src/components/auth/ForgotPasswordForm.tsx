'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, type AuthFormState } from '@/lib/auth/actions';

const initialState: AuthFormState = {};

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
        {state?.errors?.email && <p className="mt-1 text-xs text-red-500">{state.errors.email[0]}</p>}
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          We&apos;ll email you a secure reset link if the address matches an account.
        </p>
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
        {pending ? 'Sending link...' : 'Send reset link'}
      </button>

      <div className="pt-1 text-center">
        <Link href="/login" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
          Back to login
        </Link>
      </div>
    </form>
  );
}
