'use client';

import { useState } from 'react';
import {
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import DebtForm from '@/components/wealth/DebtForm';
import DebtTransactionSheet from '@/components/wealth/DebtTransactionSheet';
import { useStore } from '@/lib/store';
import type { Debt, DebtHistory, DebtHistoryId, DebtTransaction, DebtTransactionType } from '@/lib/types';
import { fmtCurrency } from '@/lib/format';

function makeHistoryEntry(old: Debt): DebtHistory {
  return {
    id: `dh-${Date.now()}` as unknown as DebtHistoryId,
    debtId: old.id,
    balance: old.currentBalance,
    date: new Date().toISOString().slice(0, 10),
    type: 'snapshot',
    amount: null,
    note: null,
  };
}

function calcEndDate(startDate: string, termMonths: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setMonth(d.getMonth() + termMonths);
  return d.toISOString().slice(0, 10);
}

type TransactionMode = DebtTransactionType;

export default function DebtsPage() {
  const store = useStore();

  const [editing, setEditing] = useState<Debt | null>(null);
  const [transactionDebt, setTransactionDebt] = useState<Debt | null>(null);
  const [transactionMode, setTransactionMode] = useState<TransactionMode>('payment');
  const [showForm, setShowForm] = useState(false);
  const [showTransactionSheet, setShowTransactionSheet] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = store.debts.filter(d => !d.archived);
  const archived = store.debts.filter(d => d.archived);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(d: Debt) { setEditing(d); setShowForm(true); }
  function openTransaction(debt: Debt, mode: TransactionMode) {
    setTransactionDebt(debt);
    setTransactionMode(mode);
    setShowTransactionSheet(true);
  }

  function handleSave(updated: Debt) {
    const existing = store.debts.find(d => d.id === updated.id);
    if (existing && existing.currentBalance !== updated.currentBalance) {
      store.upsertDebtHistory(makeHistoryEntry(existing));
    }
    store.upsertDebt(updated);
  }

  function handleTransaction(transaction: DebtTransaction) {
    store.upsertDebtTransaction(transaction);
  }

  const historyFor = (id: string) =>
    store.debtHistory
      .filter(h => h.debtId === id)
      .sort((a, b) => b.date.localeCompare(a.date));

  const transactionsFor = (id: string) =>
    store.debtTransactions
      .filter(t => t.debtId === id)
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
      <span className="hidden sm:inline">Add Debt</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Debts" subtitle={`${active.length} active`} actions={actions} backHref="/wealth" />

      {active.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
          No debts yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(d => (
            <DebtRow
              key={d.id}
              debt={d}
              history={historyFor(d.id)}
              transactions={transactionsFor(d.id)}
              onEdit={() => openEdit(d)}
              onPurchase={d.debtType === 'credit-card' ? () => openTransaction(d, 'purchase') : undefined}
              onPayment={d.debtType === 'credit-card' ? () => openTransaction(d, 'payment') : undefined}
              onArchive={() => store.setDebtArchived(d.id, true)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowArchived(v => !v)}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: 'var(--muted)' }}
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Archived ({archived.length})
          </button>
          {showArchived && (
            <div className="space-y-3" style={{ opacity: 0.7 }}>
              {archived.map(d => (
                <DebtRow
                  key={d.id}
                  debt={d}
                  history={historyFor(d.id)}
                  transactions={transactionsFor(d.id)}
                  onEdit={() => openEdit(d)}
                  onRestore={() => store.setDebtArchived(d.id, false)}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <DebtForm
        debt={editing}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
      />

      <DebtTransactionSheet
        debt={transactionDebt}
        mode={transactionMode}
        open={showTransactionSheet}
        onClose={() => setShowTransactionSheet(false)}
        onApply={handleTransaction}
      />
    </>
  );
}

interface RowProps {
  debt: Debt;
  history: DebtHistory[];
  transactions: DebtTransaction[];
  onEdit: () => void;
  onPurchase?: () => void;
  onPayment?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

function DebtRow({ debt: d, history, transactions, onEdit, onPurchase, onPayment, onArchive, onRestore, isArchived }: RowProps) {
  const [expanded, setExpanded] = useState(false);

  const isLoan = d.debtType === 'loan';
  const borrowedAmount = d.borrowedAmount;
  const termMonths = d.termMonths;
  const startDate = d.startDate;
  const canShowLoanProgress = isLoan && borrowedAmount !== null && borrowedAmount > 0 && termMonths !== null && startDate !== null;
  const repaidPct = canShowLoanProgress
    ? ((borrowedAmount - d.currentBalance) / borrowedAmount) * 100
    : null;
  const endDate = canShowLoanProgress
    ? calcEndDate(startDate, termMonths)
    : null;
  const prev = history[0];
  const change = prev ? d.currentBalance - prev.balance : null;
  const isDown = change !== null && change <= 0;
  const hasActivity = history.length > 0 || transactions.length > 0;
  const activity = [
    ...transactions.map(transaction => ({ kind: 'transaction' as const, date: transaction.date, entry: transaction })),
    ...history.map(item => ({ kind: 'history' as const, date: item.date, entry: item })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: '#f43f5e22' }}>
          <CreditCard size={16} style={{ color: '#f43f5e' }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold" style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
              {d.name}
            </p>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ background: d.debtType === 'credit-card' ? '#2563eb22' : '#10b98122', color: d.debtType === 'credit-card' ? '#2563eb' : '#10b981' }}
            >
              {d.debtType === 'credit-card' ? 'Credit Card' : 'Loan'}
            </span>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            {d.provider}{d.interestRate > 0 ? ` · ${(d.interestRate * 100).toFixed(2)}% APR` : ''}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold" style={{ color: '#f43f5e' }}>
            {fmtCurrency(d.currentBalance)}
          </p>
          {change !== null && change !== 0 && (
            <p className="text-xs" style={{ color: isDown ? '#10b981' : '#f43f5e' }}>
              {isDown ? '' : '+'}{fmtCurrency(change)}
            </p>
          )}
        </div>
      </div>

      {d.debtType === 'credit-card' && !isArchived && (
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={onPurchase}
            className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Log Purchase
          </button>
          <button
            onClick={onPayment}
            className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Log Payment
          </button>
        </div>
      )}

      {canShowLoanProgress && repaidPct !== null && endDate && (
        <div className="px-4 pb-3 -mt-1">
          <div className="mb-1 flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
            <span>{repaidPct.toFixed(1)}% repaid</span>
            <span>Ends {new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--surface-hover)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(repaidPct, 100)}%`, background: '#10b981' }} />
          </div>
        </div>
      )}

      <div className="flex gap-1 border-t px-4 py-2" style={{ borderColor: 'var(--border)' }}>
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
        {hasActivity && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span>History ({history.length + transactions.length})</span>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>

      {expanded && hasActivity && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="space-y-0 divide-y" style={{ borderColor: 'var(--border)' }}>
            {activity.map(item =>
              item.kind === 'transaction'
                ? <TransactionRow key={item.entry.id} transaction={item.entry} />
                : <HistoryRow key={item.entry.id} history={item.entry} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionRow({ transaction }: { transaction: DebtTransaction }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">
        {transaction.type === 'purchase' && <ArrowUpRight size={14} className="text-rose-500" />}
        {transaction.type === 'payment' && <ArrowDownLeft size={14} className="text-emerald-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            {transaction.type === 'purchase' ? 'Purchase' : 'Payment'}
          </p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: transaction.type === 'payment' ? '#10b981' : '#f43f5e' }}>
            {transaction.type === 'payment' ? '−' : '+'}{fmtCurrency(transaction.amount)}
          </p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
          <span>{new Date(transaction.date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}</span>
          {transaction.note && <span>{transaction.note}</span>}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ history }: { history: DebtHistory }) {
  const type = history.type ?? 'snapshot';

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">
        {type === 'purchase' && <ArrowUpRight size={14} className="text-rose-500" />}
        {type === 'payment' && <ArrowDownLeft size={14} className="text-emerald-500" />}
        {type === 'snapshot' && <ChevronRight size={14} className="text-[var(--muted)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            {type === 'purchase' ? 'Purchase' : type === 'payment' ? 'Payment' : 'Balance update'}
          </p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
            {fmtCurrency(history.balance)}
          </p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--muted)' }}>
          <span>{new Date(history.date + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}</span>
          {history.amount !== null && history.amount !== undefined && (
            <span style={{ color: type === 'payment' ? '#10b981' : type === 'purchase' ? '#f43f5e' : 'var(--muted)' }}>
              {type === 'payment' ? '−' : type === 'purchase' ? '+' : ''}{fmtCurrency(history.amount)}
            </span>
          )}
          {history.note && <span>{history.note}</span>}
        </div>
      </div>
    </div>
  );
}
