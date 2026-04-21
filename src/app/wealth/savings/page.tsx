'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight, PiggyBank, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import SavingsAccountForm from '@/components/wealth/SavingsAccountForm';
import type { AccessibleUser } from '@/lib/auth/types';
import { useStore } from '@/lib/store';
import type { SavingsAccount, SavingsHistory, SavingsHistoryId } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

// Snapshot the previous balance into history before applying the new value
function makeHistoryEntry(old: SavingsAccount): SavingsHistory {
  return {
    id:               `sh-${Date.now()}` as unknown as SavingsHistoryId,
    savingsAccountId: old.id,
    balance:          old.currentBalance,
    date:             new Date().toISOString().slice(0, 10),
  };
}

export default function SavingsPage() {
  const store = useStore();

  const [editing,      setEditing]      = useState<SavingsAccount | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active   = store.savingsAccounts.filter(a => !a.archived);
  const archived = store.savingsAccounts.filter(a =>  a.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(a: SavingsAccount) { setEditing(a); setShowForm(true); }

  function handleSave(updated: SavingsAccount) {
    // If editing and balance changed, snapshot old balance into history first
    const existing = store.savingsAccounts.find(a => a.id === updated.id);
    if (existing && existing.currentBalance !== updated.currentBalance) {
      store.upsertSavingsHistory(makeHistoryEntry(existing));
    }
    store.upsertSavingsAccount(updated);
  }

  const historyFor = (id: string) =>
    store.savingsHistory
      .filter(h => h.savingsAccountId === id)
      .sort((a, b) => b.date.localeCompare(a.date));

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Account</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Savings" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          No savings accounts yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(a => (
            <AccountRow
              key={a.id}
              account={a}
              history={historyFor(a.id)}
              accessibleUsers={store.accessibleUsers}
              onEdit={() => openEdit(a)}
              onArchive={() => store.setSavingsAccountArchived(a.id, true)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium mb-3"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="space-y-3" style={{ opacity: 0.7 }}>
              {archived.map(a => (
                <AccountRow
                  key={a.id}
                  account={a}
                  history={historyFor(a.id)}
                  accessibleUsers={store.accessibleUsers}
                  onEdit={() => openEdit(a)}
                  onRestore={() => store.setSavingsAccountArchived(a.id, false)}
                  onDelete={() => {
                    if (window.confirm(`Delete archived savings account "${a.name}" permanently?`)) {
                      store.removeSavingsAccount(a.id);
                    }
                  }}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SavingsAccountForm
        key={`${editing?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        account={editing}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  account:    SavingsAccount;
  history:    SavingsHistory[];
  accessibleUsers: AccessibleUser[];
  onEdit:     () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}

function ownershipSummary(ownerUserIds: string[], accessibleUsers: AccessibleUser[]) {
  if (ownerUserIds.length > 1) {
    const names = accessibleUsers
      .filter(user => ownerUserIds.includes(user.id))
      .map(user => user.name)
      .join(', ');
    return { label: 'Joint', detail: names || `${ownerUserIds.length} users` };
  }

  const owner = accessibleUsers.find(user => ownerUserIds.includes(user.id));
  return { label: 'Personal', detail: owner?.name ?? 'Assigned to you' };
}

function AccountRow({ account: a, history, accessibleUsers, onEdit, onArchive, onRestore, onDelete, isArchived }: RowProps) {
  const [expanded, setExpanded] = useState(false);

  const prev      = history[0];
  const change    = prev ? a.currentBalance - prev.balance : null;
  const isGain    = change !== null && change >= 0;
  const ownership = ownershipSummary(a.ownerUserIds, accessibleUsers);
  const progress = a.targetSavingsAmount && a.targetSavingsAmount > 0
    ? Math.min(100, (a.currentBalance / a.targetSavingsAmount) * 100)
    : null;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: '#10b98122' }}>
          <PiggyBank size={16} style={{ color: '#10b981' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
            {a.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {(a.interestRate * 100).toFixed(2)}% AER · {ownership.label}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(a.currentBalance)}
          </p>
          {change !== null && change !== 0 && (
            <p className="text-xs" style={{ color: isGain ? '#10b981' : '#f43f5e' }}>
              {isGain ? '+' : ''}{fmtCurrency(change)}
            </p>
          )}
          {a.targetSavingsAmount !== null && (
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Target {fmtCurrency(a.targetSavingsAmount)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Edit"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Pencil size={13} />
          </button>
          {isArchived ? (
            <>
              <button onClick={onRestore}
                className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Restore"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <ArchiveRestore size={13} />
              </button>
              <button onClick={onDelete}
                className="rounded-lg p-1.5 transition-colors" style={{ color: '#f43f5e' }} title="Delete permanently"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <Trash2 size={13} />
              </button>
            </>
          ) : (
            <button onClick={onArchive}
              className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Archive"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Archive size={13} />
            </button>
          )}
        </div>
      </div>

      {progress !== null && (
        <div className="px-4 pb-3">
          <div className="mb-1 flex items-center justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
            <span>Savings target</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: '#10b981' }}
            />
          </div>
        </div>
      )}

      {/* History toggle strip */}
      {history.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2 border-t text-xs transition-colors"
          style={{
            borderColor: 'var(--border)', color: 'var(--muted)',
            background: expanded ? 'var(--surface-hover)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = expanded ? 'var(--surface-hover)' : 'transparent')}
        >
          <span>History ({history.length})</span>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      )}

      {/* Balance history */}
      {expanded && history.length > 0 && (
        <div>
          <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
            style={{ gridTemplateColumns: '1fr auto', color: 'var(--muted)' }}>
            <span>Date</span>
            <span>Balance</span>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {history.map(h => (
              <div key={h.id} className="grid px-4 py-2.5 text-sm"
                style={{ gridTemplateColumns: '1fr auto' }}>
                <span style={{ color: 'var(--muted)' }}>
                  {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                  {fmtCurrency(h.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
