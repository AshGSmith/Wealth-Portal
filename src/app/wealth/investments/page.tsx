'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tile from '@/components/ui/Tile';
import InvestmentForm from '@/components/wealth/InvestmentForm';
import InvestmentPurchaseForm from '@/components/wealth/InvestmentPurchaseForm';
import InvestmentValuationForm from '@/components/wealth/InvestmentValuationForm';
import type { AccessibleUser } from '@/lib/auth/types';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { InvestmentHolding, InvestmentPurchase, InvestmentValuationHistory } from '@/lib/types';

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

function totalInvestedFor(
  investmentId: string,
  purchases: InvestmentPurchase[],
): number {
  return purchases
    .filter(entry => entry.investmentId === investmentId)
    .reduce((sum, entry) => sum + entry.amountInvested, 0);
}

export default function InvestmentsPage() {
  const store = useStore();
  const [editing, setEditing] = useState<InvestmentHolding | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [purchaseInvestment, setPurchaseInvestment] = useState<InvestmentHolding | null>(null);
  const [valuationInvestment, setValuationInvestment] = useState<InvestmentHolding | null>(null);

  const active = store.investments.filter(investment => !investment.archived);
  const archived = store.investments.filter(investment => investment.archived);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(investment: InvestmentHolding) {
    setEditing(investment);
    setShowForm(true);
  }

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={event => (event.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={event => (event.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Investment</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Investments" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          No investments yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(investment => (
            <InvestmentRow
              key={investment.id}
              investment={investment}
              purchases={store.investmentPurchases
                .filter(entry => entry.investmentId === investment.id)
                .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))}
              valuations={store.investmentValuationHistory
                .filter(entry => entry.investmentId === investment.id)
                .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate))}
              accessibleUsers={store.accessibleUsers}
              onEdit={() => openEdit(investment)}
              onAddPurchase={() => setPurchaseInvestment(investment)}
              onAddValuation={() => setValuationInvestment(investment)}
              onArchive={() => store.setInvestmentArchived(investment.id, true)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(value => !value)}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archived.length})
          </button>

          {showArchived && (
            <div className="space-y-3" style={{ opacity: 0.7 }}>
              {archived.map(investment => (
                <InvestmentRow
                  key={investment.id}
                  investment={investment}
                  purchases={store.investmentPurchases
                    .filter(entry => entry.investmentId === investment.id)
                    .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))}
                  valuations={store.investmentValuationHistory
                    .filter(entry => entry.investmentId === investment.id)
                    .sort((a, b) => b.valuationDate.localeCompare(a.valuationDate))}
                  accessibleUsers={store.accessibleUsers}
                  onEdit={() => openEdit(investment)}
                  onRestore={() => store.setInvestmentArchived(investment.id, false)}
                  onDelete={() => store.removeInvestment(investment.id)}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <InvestmentForm
        key={`${editing?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        investment={editing}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={({ investment, initialPurchase }) => {
          store.upsertInvestment(investment);
          if (initialPurchase) {
            store.upsertInvestmentPurchase(initialPurchase);
          }
        }}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
      />

      <InvestmentPurchaseForm
        investmentId={purchaseInvestment?.id ?? null}
        investmentName={purchaseInvestment?.name ?? ''}
        open={purchaseInvestment !== null}
        onClose={() => setPurchaseInvestment(null)}
        onSave={purchase => store.upsertInvestmentPurchase(purchase)}
      />

      <InvestmentValuationForm
        investmentId={valuationInvestment?.id ?? null}
        investmentName={valuationInvestment?.name ?? ''}
        open={valuationInvestment !== null}
        onClose={() => setValuationInvestment(null)}
        onSave={valuation => store.upsertInvestmentValuationHistory(valuation)}
      />
    </>
  );
}

interface InvestmentRowProps {
  investment: InvestmentHolding;
  purchases: InvestmentPurchase[];
  valuations: InvestmentValuationHistory[];
  accessibleUsers: AccessibleUser[];
  onEdit: () => void;
  onAddPurchase?: () => void;
  onAddValuation?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
  isArchived?: boolean;
}

function InvestmentRow({
  investment,
  purchases,
  valuations,
  accessibleUsers,
  onEdit,
  onAddPurchase,
  onAddValuation,
  onArchive,
  onRestore,
  onDelete,
  isArchived,
}: InvestmentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const ownership = ownershipSummary(investment.ownerUserIds, accessibleUsers);
  const latestValuation = valuations[0] ?? null;
  const totalInvested = totalInvestedFor(investment.id, purchases);
  const currentValue = latestValuation?.currentValue ?? 0;
  const gainLoss = currentValue - totalInvested;
  const hasValuation = latestValuation !== null;
  const gainLossPct = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : null;

  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setExpanded(value => !value)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: '#2563eb22' }}
          >
            <TrendingUp size={16} style={{ color: '#2563eb' }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p
                className="min-w-0 flex-1 text-sm font-semibold leading-snug"
                style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}
              >
                {investment.name}
              </p>
              {expanded ? (
                <ChevronDown size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              ) : (
                <ChevronRight size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
              )}
            </div>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
              {investment.tickerOrSymbol || 'No ticker'}
              {investment.provider ? ` · ${investment.provider}` : ''}
              {' · '}
              {ownership.label}
              {ownership.detail ? ` · ${ownership.detail}` : ''}
            </p>
            {gainLossPct !== null && hasValuation && (
              <p className="mt-1 text-[11px] font-medium" style={{ color: gainLoss >= 0 ? '#10b981' : '#f43f5e' }}>
                {gainLoss >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%
              </p>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--muted)' }}
            title="Edit"
            onMouseEnter={event => (event.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
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
                onMouseEnter={event => (event.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
              >
                <ArchiveRestore size={13} />
              </button>
              <button
                onClick={() => {
                  if (!onDelete) return;
                  const confirmed = window.confirm(`Permanently delete "${investment.name}" and all related purchase and valuation history?`);
                  if (confirmed) onDelete();
                }}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: '#f43f5e' }}
                title="Delete Permanently"
                onMouseEnter={event => (event.currentTarget.style.background = 'var(--surface-hover)')}
                onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
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
              onMouseEnter={event => (event.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
            >
              <Archive size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Tile
          title="Current value"
          value={hasValuation ? fmtCurrency(currentValue) : '—'}
          subtitle={hasValuation ? latestValuation.valuationDate : 'No valuation yet'}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
        />
        <Tile
          title="Total invested"
          value={fmtCurrency(totalInvested)}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
        />
        <Tile
          title="Gain / Loss"
          value={hasValuation ? `${gainLoss >= 0 ? '+' : ''}${fmtCurrency(gainLoss)}` : '—'}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
          valueStyle={hasValuation ? { color: gainLoss >= 0 ? '#10b981' : '#f43f5e' } : undefined}
        />
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          {!isArchived && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onAddPurchase}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}
              >
                + Purchase
              </button>
              <button
                onClick={onAddValuation}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: '#2563eb22', color: '#93c5fd' }}
              >
                + Valuation
              </button>
            </div>
          )}

          <HistorySection
            title="Purchases"
            emptyText="No purchases logged yet."
            rows={purchases.map(entry => ({
              id: entry.id,
              date: entry.purchaseDate,
              primary: fmtCurrency(entry.amountInvested),
              secondary: entry.sharesPurchased !== null
                ? `${entry.sharesPurchased} shares`
                : entry.note?.trim() || null,
              note: entry.sharesPurchased !== null && entry.note?.trim() ? entry.note.trim() : null,
            }))}
          />

          <HistorySection
            title="Valuations"
            emptyText="No valuations logged yet."
            rows={valuations.map(entry => ({
              id: entry.id,
              date: entry.valuationDate,
              primary: fmtCurrency(entry.currentValue),
              secondary: entry.note?.trim() || null,
            }))}
          />
        </div>
      )}
    </div>
  );
}

interface HistoryRow {
  id: string;
  date: string;
  primary: string;
  secondary: string | null;
  note?: string | null;
}

function HistorySection({
  title,
  emptyText,
  rows,
}: {
  title: string;
  emptyText: string;
  rows: HistoryRow[];
}) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          {title}
        </h3>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{row.date}</p>
                {row.secondary && (
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>{row.secondary}</p>
                )}
                {row.note && (
                  <p className="mt-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>{row.note}</p>
                )}
              </div>
              <p className="shrink-0 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                {row.primary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
