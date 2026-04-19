'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type AuthFormState } from '@/lib/auth/actions';

const inputCls = 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors';

const initialState: AuthFormState = {};

export default function LoginForm({ resetSuccess = false }: { resetSuccess?: boolean }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const hasError = Boolean(state?.message && !state?.errors);
  const hasInfo = Boolean(state?.message && state?.errors);

  return (
    <form action={action} className="space-y-4">
      {resetSuccess && (
        <p className="rounded-2xl border px-3 py-2.5 text-sm" style={{ borderColor: '#86efac', background: '#f0fdf4', color: '#166534' }}>
          Password updated successfully. Sign in with your new password.
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={inputCls}
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
        {state?.errors?.email && <p className="mt-1 text-xs text-red-500">{state.errors.email[0]}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className={inputCls}
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}
        />
        {state?.errors?.password && <p className="mt-1 text-xs text-red-500">{state.errors.password[0]}</p>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" name="rememberMe" className="h-4 w-4 rounded border" />
          Remember Me
        </label>

        <Link href="/forgot-password" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
          Forgotten Password?
        </Link>
      </div>

      {state?.message && (
        <p
          className="rounded-2xl border px-3 py-2.5 text-sm"
          style={{
            borderColor: hasError ? '#fca5a5' : hasInfo ? '#bfdbfe' : 'var(--border)',
            background: hasError ? '#fef2f2' : hasInfo ? '#eff6ff' : 'var(--primary-light)',
            color: hasError ? '#b91c1c' : hasInfo ? '#1d4ed8' : 'var(--primary)',
          }}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
