'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import SavingForm from '@/components/savings/SavingForm';
import SavingAmountHistoryForm from '@/components/savings/SavingAmountHistoryForm';
import { useStore } from '@/lib/store';
import type { Saving, SavingAmountHistory, SavingId } from '@/lib/types';
import type { AccessibleUser } from '@/lib/auth/types';
import { fmtCurrency } from '@/lib/format';

export default function SavingsPage() {
  const store = useStore();

  const [editingSaving, setEditing]     = useState<Saving | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [expandedSavingIds, setExpandedSavingIds] = useState<string[]>([]);
  const [historySavingId, setHistorySavingId] = useState<SavingId | null>(null);

  const activePots = store.pots.filter(p => !p.archived);
  const activeSources = store.sources.filter(source => !source.archived);
  const active     = store.savings.filter(s => !s.archived);
  const archived   = store.savings.filter(s =>  s.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(saving: Saving) { setEditing(saving); setShowForm(true); }
  function toggleExpanded(savingId: string) {
    setExpandedSavingIds(prev =>
      prev.includes(savingId)
        ? prev.filter(id => id !== savingId)
        : [...prev, savingId]
    );
  }

  const potName = (potId: string) => store.pots.find(p => p.id === potId)?.name ?? '—';
  const sourceName = (sourceId: string) => store.sources.find(source => source.id === sourceId)?.provider ?? '—';
  const historyForSaving = (savingId: string) =>
    [...store.savingAmountHistory]
      .filter(entry => entry.savingId === savingId)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Saving</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Savings" subtitle={`${active.length} active`} actions={actions} />

      {active.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          No savings yet.{' '}
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
              gridTemplateColumns: '1fr 100px 120px 110px 72px',
            }}
          >
            <span>Name</span>
            <span>Pot</span>
            <span>Active range</span>
            <span className="text-right">Current</span>
            <span />
          </div>

          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {active.map(saving => (
              <SavingRow
                key={saving.id}
                saving={saving}
                history={historyForSaving(saving.id)}
                isExpanded={expandedSavingIds.includes(saving.id)}
                potName={potName(saving.potId)}
                sourceName={sourceName(saving.incomeSourceId)}
                accessibleUsers={store.accessibleUsers}
                onToggleExpanded={() => toggleExpanded(saving.id)}
                onAddAmountChange={() => setHistorySavingId(saving.id)}
                onEdit={() => openEdit(saving)}
                onArchive={() => store.setSavingArchived(saving.id, true)}
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
                {archived.map(saving => (
                  <SavingRow
                    key={saving.id}
                    saving={saving}
                    history={historyForSaving(saving.id)}
                    isExpanded={expandedSavingIds.includes(saving.id)}
                    potName={potName(saving.potId)}
                    sourceName={sourceName(saving.incomeSourceId)}
                    accessibleUsers={store.accessibleUsers}
                    onToggleExpanded={() => toggleExpanded(saving.id)}
                    onAddAmountChange={() => setHistorySavingId(saving.id)}
                    onEdit={() => openEdit(saving)}
                    onRestore={() => store.setSavingArchived(saving.id, false)}
                    isArchived
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <SavingForm
        key={`${editingSaving?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        saving={editingSaving}
        pots={activePots}
        sources={activeSources}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={saving => store.upsertSaving(saving)}
      />

      {historySavingId && (
        <SavingAmountHistoryForm
          key={`${historySavingId}-${store.savingAmountHistory.length}`}
          savingId={historySavingId}
          entry={null}
          open
          onClose={() => setHistorySavingId(null)}
          onSave={entry => store.upsertSavingAmountHistory(entry)}
        />
      )}
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  saving:     Saving;
  history:    SavingAmountHistory[];
  isExpanded: boolean;
  potName:    string;
  sourceName: string;
  accessibleUsers: AccessibleUser[];
  onToggleExpanded: () => void;
  onAddAmountChange: () => void;
  onEdit:     () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

function dateRange(s: Saving): string {
  if (!s.startDate && !s.endDate) return 'Always';
  const start = s.startDate ? s.startDate.slice(0, 7) : '…';
  const end   = s.endDate   ? s.endDate.slice(0, 7)   : '…';
  return `${start} – ${end}`;
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

function currentAmount(saving: Saving, history: SavingAmountHistory[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return history.find(entry => entry.effectiveDate <= today)?.amount ?? saving.amount;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SavingRow({
  saving,
  history,
  isExpanded,
  potName,
  sourceName,
  accessibleUsers,
  onToggleExpanded,
  onAddAmountChange,
  onEdit,
  onArchive,
  onRestore,
  isArchived,
}: RowProps) {
  const ownership = ownershipSummary(saving.ownerUserIds, accessibleUsers);
  const activeAmount = currentAmount(saving, history);
  const hasHistory = history.length > 0;

  return (
    <div style={{ background: 'var(--surface)' }}>
      <div className="flex items-center px-4 py-3 gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {saving.isCritical && (
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
                {saving.name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 sm:hidden text-xs" style={{ color: 'var(--muted)' }}>
            <span>{potName}</span>
            <span>·</span>
            <span>{sourceName}</span>
            <span>·</span>
            <span>{dateRange(saving)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            <span>Default {fmtCurrency(saving.amount)}</span>
            {hasHistory && (
              <>
                <span>·</span>
                <span>{history.length} dated {history.length === 1 ? 'change' : 'changes'}</span>
              </>
            )}
          </div>
        </div>

        <span className="hidden sm:block w-[100px] text-xs truncate" style={{ color: 'var(--muted)' }}>
          {potName}
        </span>
        <span className="hidden sm:block w-[120px] text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
          {dateRange(saving)}
        </span>
        <div className="w-[110px] text-right">
          <div className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(activeAmount)}
          </div>
          {hasHistory && (
            <div className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>
              Base {fmtCurrency(saving.amount)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleExpanded}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            title={isExpanded ? 'Hide amount history' : 'Show amount history'}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
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

      {isExpanded && (
        <div className="border-t px-4 pb-3 pt-2.5 space-y-2.5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                Amount History
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Current {fmtCurrency(activeAmount)}{hasHistory ? ` · Default ${fmtCurrency(saving.amount)}` : ''}
              </p>
            </div>
            {!isArchived && (
              <button
                onClick={onAddAmountChange}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
                style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}
              >
                Add change
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              No dated amount changes yet. The default amount is currently used for all months.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                  style={{ background: 'var(--surface-hover)' }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                      {fmtDate(entry.effectiveDate)}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      Effective from this date forward
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                    {fmtCurrency(entry.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
