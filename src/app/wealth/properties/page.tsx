'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight, Home, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tile from '@/components/ui/Tile';
import PropertyForm from '@/components/wealth/PropertyForm';
import { useStore } from '@/lib/store';
import type { Property } from '@/lib/types';
import type { AccessibleUser } from '@/lib/auth/types';
import { fmtCurrency } from '@/lib/format';

export default function PropertiesPage() {
  const store = useStore();

  const [editing,      setEditing]      = useState<Property | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active   = store.properties.filter(p => !p.archived);
  const archived = store.properties.filter(p =>  p.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(p: Property) { setEditing(p); setShowForm(true); }

  const mortgageName = (id: string | null) =>
    id ? (store.mortgages.find(m => m.id === id)?.lender ?? '—') : null;

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Property</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Properties" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          No properties yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(p => (
            <PropertyRow
              key={p.id}
              property={p}
              mortgageName={mortgageName(p.mortgageId)}
              accessibleUsers={store.accessibleUsers}
              onEdit={() => openEdit(p)}
              onArchive={() => store.setPropertyArchived(p.id, true)}
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
                <PropertyRow
                  key={p.id}
                  property={p}
                  mortgageName={mortgageName(p.mortgageId)}
                  accessibleUsers={store.accessibleUsers}
                  onEdit={() => openEdit(p)}
                  onRestore={() => store.setPropertyArchived(p.id, false)}
                  onDelete={() => {
                    if (window.confirm(`Delete archived property "${p.name}" permanently?`)) {
                      store.removeProperty(p.id);
                    }
                  }}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <PropertyForm
        key={`${editing?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        property={editing}
        mortgages={store.mortgages}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={p => store.upsertProperty(p)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  property:     Property;
  mortgageName: string | null;
  accessibleUsers: AccessibleUser[];
  onEdit:       () => void;
  onArchive?:   () => void;
  onRestore?:   () => void;
  onDelete?:    () => void;
  isArchived?:  boolean;
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

function PropertyRow({ property: p, mortgageName, accessibleUsers, onEdit, onArchive, onRestore, onDelete, isArchived }: RowProps) {
  const gain    = p.currentValue - p.purchasePrice;
  const gainPct = ((gain / p.purchasePrice) * 100).toFixed(1);
  const isGain  = gain >= 0;
  const ownership = ownershipSummary(p.ownerUserIds, accessibleUsers);

  const badges = [
    ownership.label,
    p.isMainResidence && 'Main residence',
    p.isRental        && 'Rental',
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        {/* Icon + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: '#6366f122' }}>
            <Home size={16} style={{ color: '#6366f1' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate"
              style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
              {p.name}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>
              {p.address}
            </p>
          </div>
        </div>

        {/* Actions */}
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

      {/* Value row */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Tile
          title="Current value"
          value={fmtCurrency(p.currentValue)}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
        />
        <Tile
          title="Gain / Loss"
          value={`${isGain ? '+' : ''}${fmtCurrency(gain)}`}
          subtitle={`(${isGain ? '+' : ''}${gainPct}%)`}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
          valueStyle={{ color: isGain ? '#10b981' : '#f43f5e' }}
          subtitleClassName="font-medium"
          subtitleStyle={{ color: isGain ? '#10b981' : '#f43f5e' }}
        />
      </div>

      {/* Footer meta */}
      {(mortgageName || badges.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {badges.map(b => (
            <span key={b}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: b === ownership.label ? 'var(--surface-hover)' : 'var(--primary-light)',
                color: b === ownership.label ? 'var(--muted)' : 'var(--primary)',
              }}
              title={b === ownership.label ? ownership.detail : undefined}
            >
              {b}
            </span>
          ))}
          {mortgageName && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Mortgage: {mortgageName}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
