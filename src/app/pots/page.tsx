'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PotForm from '@/components/pots/PotForm';
import { useStore } from '@/lib/store';
import type { Pot } from '@/lib/types';
import { fmtSourceType } from '@/lib/format';

export default function PotsPage() {
  const store = useStore();

  const [editingPot, setEditing]        = useState<Pot | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active         = store.pots.filter(p => !p.archived);
  const archived       = store.pots.filter(p =>  p.archived);
  const activeSources  = store.sources.filter(s => !s.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(pot: Pot) { setEditing(pot); setShowForm(true); }

  const sourceName = (id: string) => store.sources.find(s => s.id === id)?.provider ?? '—';
  const sourceType = (id: string) => {
    const s = store.sources.find(src => src.id === id);
    return s ? fmtSourceType(s.type) : '';
  };

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Pot</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Pots" subtitle={`${active.length} active`} actions={actions} />

      {active.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          No pots yet.{' '}
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
              gridTemplateColumns: '1fr 1fr 56px',
            }}
          >
            <span>Name</span>
            <span>Income source</span>
            <span />
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {active.map(pot => (
              <PotRow
                key={pot.id}
                pot={pot}
                sourceName={sourceName(pot.incomeSourceId)}
                sourceType={sourceType(pot.incomeSourceId)}
                onEdit={() => openEdit(pot)}
                onArchive={() => store.setPotArchived(pot.id, true)}
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
                {archived.map(pot => (
                  <PotRow
                    key={pot.id}
                    pot={pot}
                    sourceName={sourceName(pot.incomeSourceId)}
                    sourceType={sourceType(pot.incomeSourceId)}
                    onEdit={() => openEdit(pot)}
                    onRestore={() => store.setPotArchived(pot.id, false)}
                    isArchived
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PotForm
        pot={editingPot}
        sources={activeSources}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={pot => store.upsertPot(pot)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  pot:        Pot;
  sourceName: string;
  sourceType: string;
  onEdit:     () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

function PotRow({ pot, sourceName, sourceType, onEdit, onArchive, onRestore, isArchived }: RowProps) {
  return (
    <div
      className="flex items-center px-4 py-3 gap-3"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}
        >
          {pot.name}
        </p>
        <p className="text-xs mt-0.5 sm:hidden" style={{ color: 'var(--muted)' }}>
          {sourceName} · {sourceType}
        </p>
      </div>

      <div className="hidden sm:flex flex-1 items-center gap-1.5 min-w-0">
        <span className="text-sm truncate" style={{ color: 'var(--muted)' }}>{sourceName}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>· {sourceType}</span>
      </div>

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
