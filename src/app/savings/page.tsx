'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import SavingForm from '@/components/savings/SavingForm';
import { useStore } from '@/lib/store';
import type { Saving } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

export default function SavingsPage() {
  const store = useStore();

  const [editingSaving, setEditing]     = useState<Saving | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activePots = store.pots.filter(p => !p.archived);
  const active     = store.savings.filter(s => !s.archived);
  const archived   = store.savings.filter(s =>  s.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(saving: Saving) { setEditing(saving); setShowForm(true); }

  const potName = (potId: string) => store.pots.find(p => p.id === potId)?.name ?? '—';

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
            {active.map(saving => (
              <SavingRow
                key={saving.id}
                saving={saving}
                potName={potName(saving.potId)}
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
                    potName={potName(saving.potId)}
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
        saving={editingSaving}
        pots={activePots}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={saving => store.upsertSaving(saving)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  saving:     Saving;
  potName:    string;
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

function SavingRow({ saving, potName, onEdit, onArchive, onRestore, isArchived }: RowProps) {
  return (
    <div
      className="flex items-center px-4 py-3 gap-3"
      style={{ background: 'var(--surface)' }}
    >
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
            className="text-sm font-medium truncate"
            style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}
          >
            {saving.name}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 sm:hidden text-xs" style={{ color: 'var(--muted)' }}>
          <span>{potName}</span>
          <span>·</span>
          <span>{dateRange(saving)}</span>
          <span>·</span>
          <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(saving.amount)}
          </span>
        </div>
      </div>

      <span className="hidden sm:block w-[100px] text-xs truncate" style={{ color: 'var(--muted)' }}>
        {potName}
      </span>
      <span className="hidden sm:block w-[120px] text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
        {dateRange(saving)}
      </span>
      <span className="hidden sm:block w-[80px] text-right text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
        {fmtCurrency(saving.amount)}
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
