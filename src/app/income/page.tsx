'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Archive, ArchiveRestore,
  ChevronDown, ChevronRight, ChevronUp,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import SourceForm from '@/components/income/SourceForm';
import EntryForm  from '@/components/income/EntryForm';
import SalaryHistoryForm from '@/components/income/SalaryHistoryForm';
import type { AccessibleUser } from '@/lib/auth/types';
import { isSalarySource, latestAnnualSalary, salaryHistoryForSource } from '@/lib/incomeCalc';
import { useStore } from '@/lib/store';
import type { IncomeSource, IncomeEntry, IncomeSourceId, SalaryHistory } from '@/lib/types';
import { fmtCurrency, fmtSourceType } from '@/lib/format';

type EntryModal =
  | { mode: 'create'; sourceId: IncomeSourceId }
  | { mode: 'edit';   entry: IncomeEntry };

type SalaryModal =
  | { sourceId: IncomeSourceId; entry: SalaryHistory | null };

export default function IncomePage() {
  const store = useStore();

  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(store.sources.map(s => s.id))
  );
  const [showArchived, setShowArchived] = useState(false);
  const [sourceModal, setSourceModal]   = useState<IncomeSource | null | false>(false);
  const [entryModal, setEntryModal]     = useState<EntryModal | null>(null);
  const [salaryModal, setSalaryModal]   = useState<SalaryModal | null>(null);

  const activeSources   = store.sources.filter(s => !s.archived);
  const archivedSources = store.sources.filter(s =>  s.archived);

  function entriesFor(sourceId: string) {
    return store.entries.filter(e => e.incomeSourceId === sourceId);
  }

  function salaryHistoryFor(sourceId: string) {
    return salaryHistoryForSource(sourceId, store.salaryHistory);
  }

  function handleSaveSource(saved: IncomeSource) {
    store.upsertSource(saved);
    setExpanded(prev => new Set([...prev, saved.id]));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const actions = (
    <button
      onClick={() => setSourceModal(null)}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Source</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Income" subtitle={`${activeSources.length} sources`} actions={actions} />

      <div className="space-y-3">
        {activeSources.length === 0 ? (
          <div
            className="rounded-xl border py-12 text-center text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            No income sources yet.{' '}
            <button onClick={() => setSourceModal(null)} className="underline" style={{ color: 'var(--primary)' }}>
              Add one
            </button>
          </div>
        ) : (
          activeSources.map(source => (
            <SourceCard
              key={source.id}
              source={source}
              entries={entriesFor(source.id)}
              salaryHistory={salaryHistoryFor(source.id)}
              accessibleUsers={store.accessibleUsers}
              expanded={expanded.has(source.id)}
              onToggle={() => toggleExpand(source.id)}
              onEditSource={() => setSourceModal(source)}
              onArchiveSource={() => store.setSourceArchived(source.id, true)}
              onAddSalaryChange={() => setSalaryModal({ sourceId: source.id, entry: null })}
              onAddEntry={() => setEntryModal({ mode: 'create', sourceId: source.id })}
              onEditEntry={entry => setEntryModal({ mode: 'edit', entry })}
              onArchiveEntry={entry => store.removeEntry(entry.id)}
            />
          ))
        )}
      </div>

      {archivedSources.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium mb-3"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archivedSources.length})
          </button>

          {showArchived && (
            <div className="space-y-3">
              {archivedSources.map(source => (
                <SourceCard
                  key={source.id}
                  source={source}
                  entries={entriesFor(source.id)}
                  salaryHistory={salaryHistoryFor(source.id)}
                  accessibleUsers={store.accessibleUsers}
                  expanded={expanded.has(source.id)}
                  onToggle={() => toggleExpand(source.id)}
                  onEditSource={() => setSourceModal(source)}
                  onRestoreSource={() => store.setSourceArchived(source.id, false)}
                  onAddSalaryChange={() => setSalaryModal({ sourceId: source.id, entry: null })}
                  onAddEntry={() => setEntryModal({ mode: 'create', sourceId: source.id })}
                  onEditEntry={entry => setEntryModal({ mode: 'edit', entry })}
                  onArchiveEntry={entry => store.removeEntry(entry.id)}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SourceForm
        key={`${sourceModal && typeof sourceModal === 'object' ? sourceModal.id : 'new'}-${sourceModal !== false ? 'open' : 'closed'}`}
        source={sourceModal || null}
        open={sourceModal !== false}
        onClose={() => setSourceModal(false)}
        onSave={handleSaveSource}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
      />

      <EntryForm
        entry={entryModal?.mode === 'edit' ? entryModal.entry : null}
        sourceId={
          entryModal?.mode === 'edit'
            ? entryModal.entry.incomeSourceId
            : entryModal?.mode === 'create'
              ? entryModal.sourceId
              : ('' as IncomeSourceId)
        }
        open={!!entryModal}
        onClose={() => setEntryModal(null)}
        onSave={entry => store.upsertEntry(entry)}
      />

      <SalaryHistoryForm
        key={`${salaryModal?.entry?.id ?? salaryModal?.sourceId ?? 'salary'}-${salaryModal ? 'open' : 'closed'}`}
        entry={salaryModal?.entry ?? null}
        sourceId={salaryModal?.sourceId ?? ('' as IncomeSourceId)}
        open={!!salaryModal}
        onClose={() => setSalaryModal(null)}
        onSave={entry => store.upsertSalaryHistory(entry)}
      />
    </>
  );
}

// ─── SourceCard ───────────────────────────────────────────────────────────────

interface CardProps {
  source:           IncomeSource;
  entries:          IncomeEntry[];
  salaryHistory:    SalaryHistory[];
  accessibleUsers:  AccessibleUser[];
  expanded:         boolean;
  onToggle:         () => void;
  onEditSource:     () => void;
  onArchiveSource?: () => void;
  onRestoreSource?: () => void;
  onAddSalaryChange?: () => void;
  onAddEntry:       () => void;
  onEditEntry:      (entry: IncomeEntry) => void;
  onArchiveEntry:   (entry: IncomeEntry) => void;
  isArchived?:      boolean;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
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

function SourceCard({
  source, entries, salaryHistory, accessibleUsers, expanded, onToggle,
  onEditSource, onArchiveSource, onRestoreSource,
  onAddSalaryChange, onAddEntry, onEditEntry, onArchiveEntry,
  isArchived,
}: CardProps) {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const salaryEnabled = isSalarySource(source);
  const latestSalary = latestAnnualSalary(source, salaryHistory);
  const ownership = ownershipSummary(source.ownerUserIds, accessibleUsers);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', opacity: isArchived ? 0.7 : 1 }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ background: 'var(--surface)' }}
        onClick={onToggle}
      >
        <span style={{ color: 'var(--muted)' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            {source.provider}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {fmtSourceType(source.type)} · {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {salaryEnabled && latestSalary !== null ? ` · Salary ${fmtCurrency(latestSalary)}` : ''}
          </p>
        </div>

        {entries.length > 0 && (
          <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(total)}
          </span>
        )}

        <span
          className="hidden shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:inline-flex"
          style={{ background: ownership.label === 'Joint' ? '#2563eb18' : 'var(--surface-hover)', color: ownership.label === 'Joint' ? '#2563eb' : 'var(--muted)' }}
          title={ownership.detail}
        >
          {ownership.label}
        </span>

        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onEditSource}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Edit source"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Pencil size={13} />
          </button>
          {isArchived ? (
            <button
              onClick={onRestoreSource}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--muted)' }}
              title="Restore source"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <ArchiveRestore size={13} />
            </button>
          ) : (
            <button
              onClick={onArchiveSource}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--muted)' }}
              title="Archive source"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Archive size={13} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="border-b px-4 py-2" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              {ownership.label} source
            </p>
          </div>
          {salaryEnabled && (
            <div className="border-b px-4 py-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--muted)' }}>
                    Salary
                  </p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                    {latestSalary !== null ? fmtCurrency(latestSalary) : 'Not set'}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    Latest effective annual salary
                  </p>
                </div>
                {!isArchived && onAddSalaryChange && (
                  <button
                    onClick={onAddSalaryChange}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                    style={{ color: 'var(--primary)', background: 'var(--surface)' }}
                  >
                    <Plus size={12} />
                    Add Salary Change
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border px-3 py-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Starting Salary</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                    {source.startingAnnualSalary !== null ? fmtCurrency(source.startingAnnualSalary) : '—'}
                  </p>
                </div>
                <div className="rounded-xl border px-3 py-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Salary Changes</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                    {salaryHistory.length}
                  </p>
                </div>
              </div>

              {salaryHistory.length > 0 ? (
                <div className="divide-y rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {salaryHistory.map(entry => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 px-3 py-2.5" style={{ background: 'var(--surface)' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                          {fmtCurrency(entry.annualSalary)}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                          Effective {fmtDate(entry.effectiveDate)}
                        </p>
                        {entry.note ? (
                          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                            {entry.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  No salary changes yet.
                </p>
              )}
            </div>
          )}

          {entries.length === 0 ? (
            <p className="px-4 py-4 text-xs text-center" style={{ color: 'var(--muted)' }}>
              No entries yet.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {[...entries]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                    style={{ background: 'var(--surface-hover)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm tabular-nums" style={{ color: 'var(--foreground)' }}>
                        {fmtCurrency(entry.amount)}
                      </span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
                        {fmtDate(entry.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => onEditEntry(entry)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: 'var(--muted)' }}
                        title="Edit entry"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => onArchiveEntry(entry)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: 'var(--muted)' }}
                        title="Remove entry"
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {!isArchived && (
            <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={onAddEntry}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--primary)' }}
              >
                <Plus size={13} />
                Add Entry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
