'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import PotForm from '@/components/pots/PotForm';
import { useStore } from '@/lib/store';
import type { Pot } from '@/lib/types';
import type { AccessibleUser } from '@/lib/auth/types';

export default function PotsPage() {
  const store = useStore();

  const [editingPot, setEditing]        = useState<Pot | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active         = store.pots.filter(p => !p.archived);
  const archived       = store.pots.filter(p =>  p.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(pot: Pot) { setEditing(pot); setShowForm(true); }

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
              gridTemplateColumns: '1fr 120px 56px',
            }}
          >
            <span>Name</span>
            <span>Type</span>
            <span />
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {active.map(pot => (
              <PotRow
                key={pot.id}
                pot={pot}
                canMoveUp={active[0]?.id !== pot.id}
                canMoveDown={active[active.length - 1]?.id !== pot.id}
                accessibleUsers={store.accessibleUsers}
                onEdit={() => openEdit(pot)}
                onMoveUp={() => store.movePot(pot.id, -1)}
                onMoveDown={() => store.movePot(pot.id, 1)}
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
                    accessibleUsers={store.accessibleUsers}
                    onEdit={() => openEdit(pot)}
                    onRestore={() => store.setPotArchived(pot.id, false)}
                    onDelete={() => {
                      if (window.confirm(`Delete archived pot "${pot.name}" permanently?`)) {
                        store.removePot(pot.id);
                      }
                    }}
                    isArchived
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PotForm
        key={`${editingPot?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        pot={editingPot}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={pot => store.upsertPot(pot)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  pot: Pot;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  accessibleUsers: AccessibleUser[];
  onEdit: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
  return { label: 'Personal', detail: owner?.name ?? 'Assigned to one user' };
}

function PotRow({
  pot,
  canMoveUp,
  canMoveDown,
  accessibleUsers,
  onEdit,
  onMoveUp,
  onMoveDown,
  onArchive,
  onRestore,
  onDelete,
  isArchived,
}: RowProps) {
  const ownership = ownershipSummary(pot.ownerUserIds, accessibleUsers);

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
          {pot.isBusiness ? 'Business pot' : 'Personal pot'} · {ownership.label}
        </p>
      </div>

      <div className="hidden sm:flex flex-1 items-center gap-1.5 min-w-0">
        <span className="text-sm truncate" style={{ color: 'var(--muted)' }}>
          {pot.isBusiness ? 'Business' : 'Personal'}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}
          title={ownership.detail}
        >
          {ownership.label}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isArchived ? (
          <>
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className="rounded-lg p-1.5 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ color: 'var(--muted)' }}
              title="Move up"
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <ArrowUp size={13} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className="rounded-lg p-1.5 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              style={{ color: 'var(--muted)' }}
              title="Move down"
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--surface-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <ArrowDown size={13} />
            </button>
          </>
        ) : null}
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
            <>
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
              <button
                onClick={onDelete}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: '#f43f5e' }}
                title="Delete permanently"
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={13} />
              </button>
            </>
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
