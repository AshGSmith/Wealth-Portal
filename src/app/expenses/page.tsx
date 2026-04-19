'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { useStore } from '@/lib/store';
import type { Expense } from '@/lib/types';
import type { AccessibleUser } from '@/lib/auth/types';
import { fmtCurrency } from '@/lib/format';

export default function ExpensesPage() {
  const store = useStore();

  const [editingExpense, setEditing]    = useState<Expense | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activePots = store.pots.filter(p => !p.archived);
  const activeSources = store.sources.filter(source => !source.archived);
  const active     = store.expenses.filter(e => !e.archived);
  const archived   = store.expenses.filter(e =>  e.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(expense: Expense) { setEditing(expense); setShowForm(true); }

  const potName = (potId: string) => store.pots.find(p => p.id === potId)?.name ?? '—';
  const sourceName = (sourceId: string) => store.sources.find(source => source.id === sourceId)?.provider ?? '—';

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Expense</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Expenses" subtitle={`${active.length} active`} actions={actions} />

      {active.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          No expenses yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div
            className="hidden sm:grid px-4 py-2 border-b text-[10px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--muted)',
              background: 'var(--surface)',
              gridTemplateColumns: '1fr 100px 120px 80px 72px',
            }}
          >
            <span>Name</span>
            <span>Pot</span>
            <span>Active range</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {active.map(expense => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                potName={potName(expense.potId)}
                sourceName={sourceName(expense.incomeSourceId)}
                accessibleUsers={store.accessibleUsers}
                onEdit={() => openEdit(expense)}
                onArchive={() => store.setExpenseArchived(expense.id, true)}
              />
            ))}
          </div>
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
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border)', opacity: 0.7 }}
            >
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {archived.map(expense => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    potName={potName(expense.potId)}
                    sourceName={sourceName(expense.incomeSourceId)}
                    accessibleUsers={store.accessibleUsers}
                    onEdit={() => openEdit(expense)}
                    onRestore={() => store.setExpenseArchived(expense.id, false)}
                    isArchived
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ExpenseForm
        key={`${editingExpense?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        expense={editingExpense}
        pots={activePots}
        sources={activeSources}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={expense => store.upsertExpense(expense)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  expense:    Expense;
  potName:    string;
  sourceName: string;
  accessibleUsers: AccessibleUser[];
  onEdit:     () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

function dateRange(e: Expense): string {
  if (!e.startDate && !e.endDate) return 'Always';
  const s   = e.startDate ? e.startDate.slice(0, 7) : '…';
  const end = e.endDate   ? e.endDate.slice(0, 7)   : '…';
  return `${s} – ${end}`;
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
  return { label: 'Personal', detail: owner?.name ?? 'Assigned to one user' };
}

function ExpenseRow({ expense, potName, sourceName, accessibleUsers, onEdit, onArchive, onRestore, isArchived }: RowProps) {
  const ownership = ownershipSummary(expense.ownerUserIds, accessibleUsers);

  return (
    <div
      className="flex items-center px-4 py-3 gap-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {expense.oneOffPayment && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ background: '#2563eb22', color: '#2563eb' }}
            >
              One off
            </span>
          )}
          {expense.isCritical && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ background: '#f59e0b22', color: '#f59e0b' }}
            >
              Critical
            </span>
          )}
          <span
            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}
            title={ownership.detail}
          >
            {ownership.label}
          </span>
          <span
            className="text-sm font-medium truncate"
            style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}
          >
            {expense.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 sm:hidden text-xs" style={{ color: 'var(--muted)' }}>
          <span>{potName}</span>
          <span>·</span>
          <span>{sourceName}</span>
          <span>·</span>
          <span>{dateRange(expense)}</span>
          <span>·</span>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(expense.amount)}
          </span>
        </div>
      </div>

      <span className="hidden sm:block w-[100px] text-xs truncate" style={{ color: 'var(--muted)' }}>
        {potName}
      </span>
      <span className="hidden sm:block w-[120px] text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
        {dateRange(expense)}
      </span>
      <span className="hidden sm:block w-[80px] text-right text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
        {fmtCurrency(expense.amount)}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="rounded-lg p-1.5 transition-colors"
          style={{ color: 'var(--muted)' }}
          title="Edit"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Pencil size={13} />
        </button>
        {isArchived ? (
          <button
            onClick={onRestore}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Restore"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ArchiveRestore size={13} />
          </button>
        ) : (
          <button
            onClick={onArchive}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Archive"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Archive size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
