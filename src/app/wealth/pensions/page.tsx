'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight, Briefcase, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PensionForm from '@/components/wealth/PensionForm';
import PensionPaymentForm from '@/components/wealth/PensionPaymentForm';
import type { AccessibleUser } from '@/lib/auth/types';
import { useStore } from '@/lib/store';
import { pensionReturnFromInitialInvestment, totalPensionContributionsForPension } from '@/lib/wealthCalc';
import type { Pension, PensionHistory, PensionHistoryId, PensionPayment } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

function makeHistoryEntry(old: Pension): PensionHistory {
  return {
    id:        `peh-${Date.now()}` as unknown as PensionHistoryId,
    pensionId: old.id,
    balance:   old.currentBalance,
    date:      new Date().toISOString().slice(0, 10),
  };
}

export default function PensionsPage() {
  const store = useStore();

  const [editing,      setEditing]      = useState<Pension | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [paymentPension, setPaymentPension] = useState<Pension | null>(null);

  const active   = store.pensions.filter(p => !p.archived);
  const archived = store.pensions.filter(p =>  p.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(p: Pension) { setEditing(p); setShowForm(true); }

  function handleSave(updated: Pension) {
    const existing = store.pensions.find(p => p.id === updated.id);
    if (existing && existing.currentBalance !== updated.currentBalance) {
      store.upsertPensionHistory(makeHistoryEntry(existing));
    }
    store.upsertPension(updated);
  }

  const historyFor = (id: string) =>
    store.pensionHistory
      .filter(h => h.pensionId === id)
      .sort((a, b) => b.date.localeCompare(a.date));

  const paymentsFor = (id: string) =>
    store.pensionPayments
      .filter(payment => payment.pensionId === id)
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
      <span className="hidden sm:inline">Add Pension</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Pensions" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          No pensions yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(p => (
            <PensionRow
              key={p.id}
              pension={p}
              history={historyFor(p.id)}
              payments={paymentsFor(p.id)}
              accessibleUsers={store.accessibleUsers}
              onEdit={() => openEdit(p)}
              onAddPayment={() => setPaymentPension(p)}
              onArchive={() => store.setPensionArchived(p.id, true)}
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
              {archived.map(p => (
                <PensionRow
                  key={p.id}
                  pension={p}
                  history={historyFor(p.id)}
                  payments={paymentsFor(p.id)}
                  accessibleUsers={store.accessibleUsers}
                  onEdit={() => openEdit(p)}
                  onRestore={() => store.setPensionArchived(p.id, false)}
                  onDelete={() => {
                    if (window.confirm(`Delete archived pension "${p.name}" permanently?`)) {
                      store.removePension(p.id);
                    }
                  }}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <PensionForm
        key={`${editing?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        pension={editing}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
      />

      <PensionPaymentForm
        key={`${paymentPension?.id ?? 'none'}-${paymentPension ? 'open' : 'closed'}`}
        pensionId={paymentPension?.id ?? null}
        pensionName={paymentPension?.name ?? ''}
        open={paymentPension !== null}
        onClose={() => setPaymentPension(null)}
        onSave={payment => store.upsertPensionPayment(payment)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  pension:    Pension;
  history:    PensionHistory[];
  payments:   PensionPayment[];
  accessibleUsers: AccessibleUser[];
  onEdit:     () => void;
  onAddPayment?: () => void;
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

function PensionRow({ pension: p, history, payments, accessibleUsers, onEdit, onAddPayment, onArchive, onRestore, onDelete, isArchived }: RowProps) {
  const [expanded, setExpanded] = useState(false);

  const totalContributed = totalPensionContributionsForPension(p.id, payments);
  const initialInvestmentReturn = pensionReturnFromInitialInvestment(p);
  const contributionReturn = totalContributed > 0 ? p.currentBalance - totalContributed : null;
  const previousSnapshot = history[0] ?? null;
  const historicalChange = previousSnapshot ? p.currentBalance - previousSnapshot.balance : null;
  const roiValue = initialInvestmentReturn ?? contributionReturn ?? historicalChange;
  const roiLabel = initialInvestmentReturn !== null
    ? 'vs initial'
    : contributionReturn !== null
      ? 'vs contributed'
      : historicalChange !== null
        ? 'vs prior'
        : null;
  const isGain = (roiValue ?? 0) >= 0;
  const ownership = ownershipSummary(p.ownerUserIds, accessibleUsers);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-4">
        <div className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
          style={{ background: '#3b82f622' }}>
          <Briefcase size={16} style={{ color: '#3b82f6' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
            {p.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {p.provider} · {ownership.label}
          </p>
          {p.initialInvestment !== null ? (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
              Initial {fmtCurrency(p.initialInvestment)}
            </p>
          ) : totalContributed > 0 ? (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
              Contributed {fmtCurrency(totalContributed)}
            </p>
          ) : null}
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(p.currentBalance)}
          </p>
          {roiValue !== null && (
            <p className="text-xs" style={{ color: isGain ? '#10b981' : '#f43f5e' }}>
              {isGain ? '+' : ''}{fmtCurrency(roiValue)}
              {roiLabel ? ` ${roiLabel}` : ''}
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
          {!isArchived && onAddPayment && (
            <button onClick={onAddPayment}
              className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Log contribution"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Plus size={13} />
            </button>
          )}
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

      {/* History toggle */}
      {(history.length > 0 || payments.length > 0) && (
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

      {expanded && (
        <div>
          {payments.length > 0 && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ gridTemplateColumns: '1fr auto auto', color: 'var(--muted)' }}>
                <span>Contribution</span>
                <span>Employee</span>
                <span>Employer</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {payments.map(payment => (
                  <div key={payment.id} className="space-y-1 px-4 py-2.5 text-sm">
                    <div className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr auto auto' }}>
                      <div className="min-w-0">
                        <span style={{ color: 'var(--muted)' }}>
                          {new Date(payment.date + 'T00:00:00').toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                        {payment.note && (
                          <p className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--muted)' }}>
                            {payment.note}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                        {fmtCurrency(payment.employeeContribution)}
                      </span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                        {fmtCurrency(payment.employerContribution)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="grid px-4 py-2 text-[10px] font-semibold uppercase tracking-wide"
                style={{ gridTemplateColumns: '1fr auto', color: 'var(--muted)' }}>
                <span>Balance Snapshot</span>
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
      )}
    </div>
  );
}
