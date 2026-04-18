'use client';

import { useState } from 'react';
import { Plus, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight, Landmark, Receipt } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Tile from '@/components/ui/Tile';
import MortgageForm from '@/components/wealth/MortgageForm';
import MortgagePaymentSheet from '@/components/wealth/MortgagePaymentSheet';
import { useStore } from '@/lib/store';
import type { Mortgage } from '@/lib/types';
import { mortgageBalance, mortgageFixedTermInterest, mortgageLiability } from '@/lib/wealthCalc';
import { fmtCurrency } from '@/lib/format';

export default function MortgagesPage() {
  const store = useStore();

  const [editing,        setEditing]        = useState<Mortgage | null>(null);
  const [showForm,       setShowForm]       = useState(false);
  const [paymentsFor,    setPaymentsFor]    = useState<Mortgage | null>(null);
  const [showPayments,   setShowPayments]   = useState(false);
  const [showArchived,   setShowArchived]   = useState(false);

  const active   = store.mortgages.filter(m => !m.archived);
  const archived = store.mortgages.filter(m =>  m.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(m: Mortgage) { setEditing(m); setShowForm(true); }
  function openPayments(m: Mortgage) { setPaymentsFor(m); setShowPayments(true); }

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Mortgage</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Mortgages" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          No mortgages yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(m => (
            <MortgageRow
              key={m.id}
              mortgage={m}
              outstanding={mortgageBalance(m, store.mortgagePayments)}
              fixedInterest={mortgageFixedTermInterest(m, store.mortgagePayments)}
              totalLiability={mortgageLiability(m, store.mortgagePayments)}
              paymentCount={store.mortgagePayments.filter(p => p.mortgageId === m.id).length}
              onEdit={() => openEdit(m)}
              onPayments={() => openPayments(m)}
              onArchive={() => store.setMortgageArchived(m.id, true)}
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
              {archived.map(m => (
                <MortgageRow
                  key={m.id}
                  mortgage={m}
                  outstanding={mortgageBalance(m, store.mortgagePayments)}
                  fixedInterest={mortgageFixedTermInterest(m, store.mortgagePayments)}
                  totalLiability={mortgageLiability(m, store.mortgagePayments)}
                  paymentCount={store.mortgagePayments.filter(p => p.mortgageId === m.id).length}
                  onEdit={() => openEdit(m)}
                  onPayments={() => openPayments(m)}
                  onRestore={() => store.setMortgageArchived(m.id, false)}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <MortgageForm
        mortgage={editing}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={m => store.upsertMortgage(m)}
      />

      <MortgagePaymentSheet
        mortgage={paymentsFor}
        payments={store.mortgagePayments}
        open={showPayments}
        onClose={() => setShowPayments(false)}
        onAdd={p => store.upsertMortgagePayment(p)}
        onRemove={id => store.removeMortgagePayment(id)}
      />
    </>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  mortgage:      Mortgage;
  outstanding:   number;
  fixedInterest: number;
  totalLiability: number;
  paymentCount:  number;
  onEdit:        () => void;
  onPayments:    () => void;
  onArchive?:    () => void;
  onRestore?:    () => void;
  isArchived?:   boolean;
}

function MortgageRow({ mortgage: m, outstanding, fixedInterest, totalLiability, paymentCount, onEdit, onPayments, onArchive, onRestore, isArchived }: RowProps) {
  const paidOff = ((m.amountBorrowed - outstanding) / m.amountBorrowed) * 100;

  return (
    <div id={m.id as string} className="rounded-xl border p-4 scroll-mt-24" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ background: '#f59e0b22' }}>
            <Landmark size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
              {m.lender}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {(m.interestRate * 100).toFixed(2)}% · {m.termMonths} months ({(m.termMonths / 12).toFixed(0)} yrs)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onPayments}
            className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Payments"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Receipt size={13} />
          </button>
          <button onClick={onEdit}
            className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Edit"
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <Pencil size={13} />
          </button>
          {isArchived ? (
            <button onClick={onRestore}
              className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--muted)' }} title="Restore"
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <ArchiveRestore size={13} />
            </button>
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

      {/* Stats */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Tile
          title="Principal"
          value={fmtCurrency(outstanding)}
          size="sm"
          surface="subtle"
          titleClassName="text-[10px] font-medium uppercase tracking-wide"
          valueClassName="text-sm font-bold"
        />
        {fixedInterest > 0 ? (
          <>
            <Tile
              title="Fixed interest"
              value={fmtCurrency(fixedInterest)}
              size="sm"
              surface="subtle"
              titleClassName="text-[10px] font-medium uppercase tracking-wide"
              valueClassName="text-sm font-bold"
              valueStyle={{ color: '#f59e0b' }}
            />
            <Tile
              title="Total liability"
              value={fmtCurrency(totalLiability)}
              size="sm"
              surface="subtle"
              titleClassName="text-[10px] font-medium uppercase tracking-wide"
              valueClassName="text-sm font-bold"
              valueStyle={{ color: '#f43f5e' }}
            />
          </>
        ) : (
          <Tile
            title="Borrowed"
            value={fmtCurrency(m.amountBorrowed)}
            size="sm"
            surface="subtle"
            className="sm:col-span-2"
            titleClassName="text-[10px] font-medium uppercase tracking-wide"
            valueClassName="text-sm font-bold"
          />
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--muted)' }}>
          <span>{paidOff.toFixed(1)}% paid off</span>
          <span>{paymentCount} payment{paymentCount !== 1 ? 's' : ''} logged</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-hover)' }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(paidOff, 100)}%`, background: '#10b981' }} />
        </div>
      </div>
    </div>
  );
}
