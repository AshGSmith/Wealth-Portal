'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, UserPlus } from 'lucide-react';
import {
  adminResetPasswordAction,
  createUserAction,
  deleteUserAction,
  impersonateUserAction,
  updateUserAction,
} from '@/lib/auth/actions';
import type { ManagedUser } from '@/lib/auth/types';

const cardStyle = {
  background: 'var(--surface)',
  borderColor: 'var(--border)',
} as const;

export default function UsersManager({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: ManagedUser[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name) || a.email.localeCompare(b.email)),
    [users],
  );

  function runAction(action: () => Promise<{ error?: string } | void>, successMessage: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result && 'error' in result && result.error) {
        setMessage(result.error);
        return;
      }
      setConfirmDeleteUserId(null);
      setShowCreateForm(false);
      setMessage(successMessage);
      router.refresh();
    });
  }

  function toggleExpanded(userId: string) {
    setExpandedUserId(current => current === userId ? null : userId);
    setConfirmDeleteUserId(null);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border p-4" style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>User Management</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
              Manage access, linked users, admin status, resets, and impersonation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm(current => !current)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
            aria-label={showCreateForm ? 'Close new user form' : 'Create new user'}
            title={showCreateForm ? 'Close' : 'Create new user'}
          >
            {showCreateForm ? <ChevronDown size={18} /> : <Plus size={18} />}
          </button>
        </div>

        {showCreateForm ? (
          <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <CreateUserForm
              disabled={pending}
              onSubmit={formData => runAction(() => createUserAction(formData), 'User created and invitation email sent.')}
            />
          </div>
        ) : null}
      </section>

      {message ? (
        <p className="rounded-2xl border px-3 py-2.5 text-sm" style={{ borderColor: '#bfdbfe', background: '#eff6ff', color: '#1d4ed8' }}>
          {message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border" style={cardStyle}>
        {sortedUsers.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
            No users found.
          </div>
        ) : (
          sortedUsers.map((user, index) => {
            const expanded = expandedUserId === user.id;
            return (
              <section
                key={user.id}
                className={index === 0 ? '' : 'border-t'}
                style={{ borderColor: 'var(--border)' }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(user.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: expanded ? 'var(--surface-hover)' : 'transparent' }}
                >
                  <span className="shrink-0" style={{ color: 'var(--muted)' }}>
                    {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {user.name}
                      </p>
                      <CompactBadge label={user.isAdmin ? 'Admin' : 'Standard'} />
                      <CompactBadge label={user.isActive ? 'Active' : 'Inactive'} />
                      {user.linkedUserIds.length > 0 ? <CompactBadge label={`${user.linkedUserIds.length} linked`} /> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>
                      {user.email}
                    </p>
                  </div>

                  {user.id !== currentUserId ? (
                    <form
                      action={impersonateUserAction}
                      onClick={event => event.stopPropagation()}
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        className="rounded-xl px-3 py-2 text-xs font-semibold"
                        style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
                      >
                        Impersonate
                      </button>
                    </form>
                  ) : (
                    <span className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}>
                      You
                    </span>
                  )}
                </button>

                {expanded ? (
                  <div className="border-t px-4 py-4" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <DetailCard label="Name" value={user.name} />
                      <DetailCard label="Email" value={user.email} />
                      <DetailCard label="Date of birth" value={user.dateOfBirth ?? 'Not set'} />
                      <DetailCard label="Linked users" value={user.linkedUserIds.length > 0 ? String(user.linkedUserIds.length) : 'None'} />
                    </div>

                    <EditUserForm
                      user={user}
                      users={sortedUsers}
                      disabled={pending}
                      onSave={formData => runAction(() => updateUserAction(formData), 'User updated.')}
                    />

                    <ResetPasswordForm
                      userId={user.id}
                      disabled={pending}
                      onReset={formData => runAction(() => adminResetPasswordAction(formData), 'Password reset.')}
                    />

                    {user.id !== currentUserId ? (
                      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                        {confirmDeleteUserId === user.id ? (
                          <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor: '#fca5a5', background: '#fef2f2' }}>
                            <p className="text-sm font-medium" style={{ color: '#991b1b' }}>
                              Delete {user.name}?
                            </p>
                            <p className="text-xs leading-5" style={{ color: '#b91c1c' }}>
                              This removes their sign-in access, linked-user connections, and active sessions. Existing record ownership references are left untouched and handled safely.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
                                style={{ borderColor: '#fca5a5', color: '#991b1b', background: '#fff' }}
                              >
                                Cancel
                              </button>
                              <form
                                className="flex-1"
                                action={formData => runAction(() => deleteUserAction(formData), 'User deleted.')}
                              >
                                <input type="hidden" name="userId" value={user.id} />
                                <button
                                  type="submit"
                                  disabled={pending}
                                  className="w-full rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                  style={{ background: '#dc2626' }}
                                >
                                  Delete user
                                </button>
                              </form>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                                Delete user
                              </p>
                              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                Remove this user intentionally after confirmation.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(user.id)}
                              className="rounded-xl px-3 py-2 text-xs font-semibold"
                              style={{ background: '#fee2e2', color: '#b91c1c' }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function CompactBadge({ label }: { label: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px]"
      style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}
    >
      {label}
    </span>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--foreground)' }}>
        {value}
      </p>
    </div>
  );
}

function CreateUserForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      action={formData => onSubmit(formData)}
    >
      <Field label="Name" name="name" required />
      <Field label="Email" name="email" type="email" required />
      <Field label="Date of birth" name="dateOfBirth" type="date" />

      <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" name="isAdmin" className="h-4 w-4 rounded" />
          Admin user
        </label>
      </div>
      <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4 rounded" />
          Active
        </label>
      </div>

      <div className="sm:col-span-2 rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p style={{ color: 'var(--muted)' }}>
          After creation, the user will receive an email invitation with a secure link to set their own password.
        </p>
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        <UserPlus size={16} />
        Create user
      </button>
    </form>
  );
}

function EditUserForm({
  user,
  users,
  disabled,
  onSave,
}: {
  user: ManagedUser;
  users: ManagedUser[];
  disabled: boolean;
  onSave: (formData: FormData) => void;
}) {
  const linkableUsers = users.filter(candidate => candidate.id !== user.id);

  return (
    <form
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"
      style={{ borderColor: 'var(--border)' }}
      action={formData => onSave(formData)}
    >
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
          Edit User
        </p>
      </div>
      <input type="hidden" name="id" value={user.id} />
      <Field label="Name" name="name" defaultValue={user.name} required />
      <Field label="Email" name="email" type="email" defaultValue={user.email} required />
      <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={user.dateOfBirth ?? ''} />

      <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" name="isAdmin" defaultChecked={user.isAdmin} className="h-4 w-4 rounded" />
          Admin user
        </label>
      </div>
      <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" name="isActive" defaultChecked={user.isActive} className="h-4 w-4 rounded" />
          Active
        </label>
      </div>

      <div className="sm:col-span-2 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Linked users</p>
        {linkableUsers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No other users available to link.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {linkableUsers.map(candidate => (
              <label
                key={candidate.id}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--background)' }}
              >
                <input
                  type="checkbox"
                  name="linkedUserIds"
                  value={candidate.id}
                  defaultChecked={user.linkedUserIds.includes(candidate.id)}
                  className="h-4 w-4 rounded"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{candidate.name}</span>
                  <span className="block truncate text-xs" style={{ color: 'var(--muted)' }}>{candidate.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="sm:col-span-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60"
        style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        Save changes
      </button>
    </form>
  );
}

function ResetPasswordForm({
  userId,
  disabled,
  onReset,
}: {
  userId: string;
  disabled: boolean;
  onReset: (formData: FormData) => void;
}) {
  return (
    <form
      className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto]"
      style={{ borderColor: 'var(--border)' }}
      action={formData => onReset(formData)}
    >
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Field label="Temporary password" name="password" type="password" required />
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          Set a new password directly for this user.
        </p>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--primary)' }}
      >
        Reset password
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
      />
    </label>
  );
}
