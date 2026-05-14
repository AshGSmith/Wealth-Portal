'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ChevronDown, ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import SubscriptionForm from '@/components/subscriptions/SubscriptionForm';
import SubscriptionPriceHistoryForm from '@/components/subscriptions/SubscriptionPriceHistoryForm';
import SubscriptionResubscribeForm from '@/components/subscriptions/SubscriptionResubscribeForm';
import Tile from '@/components/ui/Tile';
import { subscriptionPriceForMonth } from '@/lib/budgetLogic';
import { fmtCurrency } from '@/lib/format';
import { useStore } from '@/lib/store';
import {
  currenciesRequiringFx,
  exchangeRatePath,
  formatSubscriptionCurrency,
  subscriptionAmountToGbp,
  type SubscriptionFxRates,
} from '@/lib/subscriptionCurrency';
import { currentIsoDate, subscriptionLifecycleAlerts, type SubscriptionLifecycleAlert } from '@/lib/subscriptionCalc';
import type { AccessibleUser } from '@/lib/auth/types';
import type { ISODate, Subscription, SubscriptionCurrency, SubscriptionPriceHistory } from '@/lib/types';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthlyCostForSchedule(cost: number, schedule: Subscription['paymentSchedule']): number {
  if (schedule === 'Weekly') return (cost * 52) / 12;
  if (schedule === 'Monthly') return cost;
  return 0;
}

function annualCostForSchedule(cost: number, schedule: Subscription['paymentSchedule']): number {
  if (schedule === 'Weekly') return cost * 52;
  if (schedule === 'Monthly') return cost * 12;
  return cost;
}

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function subscriptionAlertText(alert: SubscriptionLifecycleAlert): string {
  const verb = alert.kind === 'contract' ? 'Contract ends' : 'Renews';
  const suffix = alert.daysUntil === 0
    ? 'today'
    : `in ${alert.daysUntil} day${alert.daysUntil === 1 ? '' : 's'}`;
  return `${verb} ${suffix} · ${fmtDate(alert.date)}`;
}

function SubscriptionPriceValue({
  amount,
  currency,
  fxRates,
  align = 'right',
}: {
  amount: number;
  currency: SubscriptionCurrency;
  fxRates: SubscriptionFxRates;
  align?: 'left' | 'right';
}) {
  const amountGbp = subscriptionAmountToGbp(amount, currency, fxRates);
  const isConverted = currency !== 'GBP';

  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <div className="text-sm font-bold tabular-nums" style={{ color: amountGbp === null ? '#f43f5e' : 'var(--foreground)' }}>
        {amountGbp !== null ? fmtCurrency(amountGbp) : 'FX unavailable'}
      </div>
      {isConverted && (
        <div className="text-[10px] tabular-nums" style={{ color: 'var(--muted)' }}>
          ({formatSubscriptionCurrency(amount, currency)})
        </div>
      )}
    </div>
  );
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

export default function SubscriptionsPage() {
  const store = useStore();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [priceChangeSubscription, setPriceChangeSubscription] = useState<Subscription | null>(null);
  const [resubscribeSubscription, setResubscribeSubscription] = useState<Subscription | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activePots = store.pots.filter(pot => !pot.archived);
  const activeSources = store.sources.filter(source => !source.archived);
  const sortByCriticalThenName = (a: Subscription, b: Subscription) =>
    Number(b.isCriticalExpense) - Number(a.isCriticalExpense) || a.name.localeCompare(b.name);
  const active = store.subscriptions.filter(subscription => !subscription.archived).sort(sortByCriticalThenName);
  const archived = store.subscriptions.filter(subscription => subscription.archived).sort(sortByCriticalThenName);
  const lifecycleAlerts = subscriptionLifecycleAlerts(store.subscriptions, currentIsoDate());
  const [fxRates, setFxRates] = useState<SubscriptionFxRates>({});
  const [fxUnavailableCurrencies, setFxUnavailableCurrencies] = useState<Array<Exclude<SubscriptionCurrency, 'GBP'>>>([]);

  const activePrices = useMemo(() => active.map(subscription => ({
    subscription,
    price: subscriptionPriceForMonth(subscription, store.subscriptionPriceHistory, currentMonth()),
  })), [active, store.subscriptionPriceHistory]);

  const fxCurrencies = useMemo(
    () => currenciesRequiringFx(activePrices.map(item => item.price.currency)),
    [activePrices],
  );
  const fxCurrencyKey = fxCurrencies.join('|');

  useEffect(() => {
    const currencies = fxCurrencyKey
      .split('|')
      .filter(Boolean) as Array<Exclude<SubscriptionCurrency, 'GBP'>>;

    if (currencies.length === 0) {
      setFxRates({});
      setFxUnavailableCurrencies([]);
      return;
    }

    let cancelled = false;

    async function loadFxRates() {
      const results = await Promise.all(currencies.map(async currency => {
        try {
          const response = await fetch(exchangeRatePath(currency), { cache: 'no-store' });
          const data = await response.json() as { rateToGbp?: number };
          if (!response.ok || !Number.isFinite(data.rateToGbp)) throw new Error('Exchange rate unavailable.');
          return { currency, rate: data.rateToGbp ?? null };
        } catch {
          return { currency, rate: null };
        }
      }));

      if (cancelled) return;

      setFxRates(Object.fromEntries(
        results
          .filter(result => result.rate !== null)
          .map(result => [result.currency, result.rate]),
      ) as SubscriptionFxRates);
      setFxUnavailableCurrencies(results
        .filter(result => result.rate === null)
        .map(result => result.currency));
    }

    void loadFxRates();

    return () => {
      cancelled = true;
    };
  }, [fxCurrencyKey]);

  const subscriptionSummary = useMemo(() => {
    function toGbp(amount: number, currency: string): number {
      return subscriptionAmountToGbp(amount, currency as SubscriptionCurrency, fxRates) ?? 0;
    }

    return activePrices.reduce(
      (totals, { subscription, price }) => ({
        monthlyCost: totals.monthlyCost + toGbp(monthlyCostForSchedule(price.cost, subscription.paymentSchedule), price.currency),
        annualCost: totals.annualCost + toGbp(annualCostForSchedule(price.cost, subscription.paymentSchedule), price.currency),
      }),
      { monthlyCost: 0, annualCost: 0 },
    );
  }, [activePrices, fxRates]);

  const summarySubtitle = fxUnavailableCurrencies.length > 0
    ? `${fxUnavailableCurrencies.join('/')} prices excluded: FX unavailable`
    : fxCurrencies.some(currency => fxRates[currency] === undefined)
      ? `Converting ${fxCurrencies.join('/')} prices`
      : `${active.length} active subscription${active.length === 1 ? '' : 's'}`;

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(subscription: Subscription) {
    setEditing(subscription);
    setShowForm(true);
  }

  function handleResubscribe(subscription: Subscription, startDate: ISODate) {
    store.upsertSubscription({
      ...subscription,
      status: 'Current',
      archived: false,
      paymentDate: startDate,
      paymentDay: Number(startDate.slice(8, 10)) || subscription.paymentDay,
      endDate: null,
    });
  }

  const potName = (potId: string) => store.pots.find(pot => pot.id === potId)?.name ?? '-';
  const sourceName = (sourceId: string) => store.sources.find(source => source.id === sourceId)?.provider ?? '-';
  const historyFor = (subscriptionId: string) => store.subscriptionPriceHistory
    .filter(entry => entry.subscriptionId === subscriptionId)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const actions = (
    <button
      onClick={openCreate}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
      style={{ background: 'var(--primary)', color: '#fff' }}
      onMouseEnter={event => (event.currentTarget.style.background = 'var(--primary-hover)')}
      onMouseLeave={event => (event.currentTarget.style.background = 'var(--primary)')}
    >
      <Plus size={13} />
      <span className="hidden sm:inline">Add Subscription</span>
      <span className="sm:hidden">Add</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Subscriptions" subtitle={`${active.length} active`} actions={actions} />

      {lifecycleAlerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {lifecycleAlerts.map(alert => (
            <button
              key={`${alert.subscriptionId}-${alert.kind}-${alert.date}`}
              onClick={() => {
                const subscription = store.subscriptions.find(item => item.id === alert.subscriptionId);
                if (subscription) openEdit(subscription);
              }}
              className="flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
              style={{ background: '#2563eb14', borderColor: '#2563eb55' }}
              onMouseEnter={event => (event.currentTarget.style.background = '#2563eb22')}
              onMouseLeave={event => (event.currentTarget.style.background = '#2563eb14')}
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0" style={{ color: '#60a5fa' }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{alert.subscriptionName}</p>
                <p className="mt-0.5 text-xs" style={{ color: '#60a5fa' }}>{subscriptionAlertText(alert)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Tile
          title="Monthly Cost"
          value={fmtCurrency(subscriptionSummary.monthlyCost)}
          subtitle={summarySubtitle}
          size="sm"
          className="min-h-[82px] sm:min-h-[92px]"
          titleClassName="text-[11px] uppercase tracking-[0.08em]"
          valueClassName="text-[clamp(0.9rem,4vw,1.1rem)] sm:text-[clamp(1rem,1.8vw,1.2rem)]"
          subtitleClassName="text-[10px] leading-3.5 sm:text-[11px] sm:leading-4"
          valueStyle={{ color: '#2563eb' }}
        />
        <Tile
          title="Annual Cost"
          value={fmtCurrency(subscriptionSummary.annualCost)}
          subtitle={summarySubtitle}
          size="sm"
          className="min-h-[82px] sm:min-h-[92px]"
          titleClassName="text-[11px] uppercase tracking-[0.08em]"
          valueClassName="text-[clamp(0.9rem,4vw,1.1rem)] sm:text-[clamp(1rem,1.8vw,1.2rem)]"
          subtitleClassName="text-[10px] leading-3.5 sm:text-[11px] sm:leading-4"
          valueStyle={{ color: '#10b981' }}
        />
      </div>

      {active.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
        >
          No subscriptions yet.{' '}
          <button onClick={openCreate} className="underline" style={{ color: 'var(--primary)' }}>
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(subscription => (
            <SubscriptionRow
              key={subscription.id}
              subscription={subscription}
              history={historyFor(subscription.id)}
              potName={potName(subscription.potId)}
              sourceName={sourceName(subscription.incomeSourceId)}
              accessibleUsers={store.accessibleUsers}
              onEdit={() => openEdit(subscription)}
              onLogPriceChange={() => setPriceChangeSubscription(subscription)}
              onRemovePriceHistory={id => store.removeSubscriptionPriceHistory(id)}
              onArchive={() => store.setSubscriptionArchived(subscription.id, true)}
              fxRates={fxRates}
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
              {archived.map(subscription => (
                <SubscriptionRow
                  key={subscription.id}
                  subscription={subscription}
                  history={historyFor(subscription.id)}
                  potName={potName(subscription.potId)}
                  sourceName={sourceName(subscription.incomeSourceId)}
                  accessibleUsers={store.accessibleUsers}
                  onEdit={() => openEdit(subscription)}
                  onLogPriceChange={() => setPriceChangeSubscription(subscription)}
                  onRemovePriceHistory={id => store.removeSubscriptionPriceHistory(id)}
                  onResubscribe={() => setResubscribeSubscription(subscription)}
                  fxRates={fxRates}
                  onDelete={() => {
                    if (window.confirm(`Delete archived subscription "${subscription.name}" permanently?`)) {
                      store.removeSubscription(subscription.id);
                    }
                  }}
                  isArchived
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SubscriptionForm
        key={`${editing?.id ?? 'new'}-${showForm ? 'open' : 'closed'}`}
        subscription={editing}
        pots={activePots}
        sources={activeSources}
        ownerOptions={store.accessibleUsers}
        currentUserId={store.currentUserId}
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={subscription => store.upsertSubscription(subscription)}
      />

      <SubscriptionPriceHistoryForm
        key={`${priceChangeSubscription?.id ?? 'none'}-${priceChangeSubscription ? 'open' : 'closed'}`}
        subscription={priceChangeSubscription}
        open={priceChangeSubscription !== null}
        onClose={() => setPriceChangeSubscription(null)}
        onSave={entry => store.upsertSubscriptionPriceHistory(entry)}
      />

      <SubscriptionResubscribeForm
        key={`${resubscribeSubscription?.id ?? 'none'}-${resubscribeSubscription ? 'open' : 'closed'}`}
        subscription={resubscribeSubscription}
        open={resubscribeSubscription !== null}
        onClose={() => setResubscribeSubscription(null)}
        onSave={date => {
          if (resubscribeSubscription) handleResubscribe(resubscribeSubscription, date);
        }}
      />
    </>
  );
}

interface RowProps {
  subscription: Subscription;
  history: SubscriptionPriceHistory[];
  potName: string;
  sourceName: string;
  accessibleUsers: AccessibleUser[];
  onEdit: () => void;
  onLogPriceChange: () => void;
  onRemovePriceHistory: (id: string) => void;
  onArchive?: () => void;
  onResubscribe?: () => void;
  onDelete?: () => void;
  fxRates: SubscriptionFxRates;
  isArchived?: boolean;
}

function SubscriptionRow({
  subscription,
  history,
  potName,
  sourceName,
  accessibleUsers,
  onEdit,
  onLogPriceChange,
  onRemovePriceHistory,
  onArchive,
  onResubscribe,
  onDelete,
  fxRates,
  isArchived,
}: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const ownership = ownershipSummary(subscription.ownerUserIds, accessibleUsers);
  const statusColor = subscription.status === 'Current' ? '#10b981' : '#f43f5e';
  const currentPrice = subscriptionPriceForMonth(subscription, history, currentMonth());

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => setExpanded(value => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
              style={{ background: `${statusColor}22`, color: statusColor }}
            >
              {subscription.status}
            </span>
            {subscription.freeTrial && (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: '#2563eb22', color: '#60a5fa' }}>
                Trial
              </span>
            )}
            {subscription.isCriticalExpense && (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
                Critical
              </span>
            )}
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
              style={{ background: 'var(--surface-hover)', color: 'var(--muted)' }}
              title={ownership.detail}
            >
              {ownership.label}
            </span>
          </div>

          <div className="mt-2 flex items-start gap-2">
            {expanded ? (
              <ChevronDown size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
            ) : (
              <ChevronRight size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--muted)' }} />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: isArchived ? 'var(--muted)' : 'var(--foreground)' }}>
                {subscription.name}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                {subscription.category} · {subscription.paymentSchedule} · {subscription.paymentMethod}
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                {potName} · {sourceName} · Started {fmtDate(subscription.paymentDate)} · Pay day {subscription.paymentDay}
              </p>
              {subscription.freeTrial && subscription.freeTrialExpiryDate && (
                <p className="mt-0.5 text-xs" style={{ color: '#60a5fa' }}>
                  Free trial ends {fmtDate(subscription.freeTrialExpiryDate)}
                </p>
              )}
              {subscription.contractEndDate && (
                <p className="mt-0.5 text-xs" style={{ color: '#60a5fa' }}>
                  Contract ends {fmtDate(subscription.contractEndDate)}
                </p>
              )}
              {subscription.autoRenew && subscription.renewalDate && (
                <p className="mt-0.5 text-xs" style={{ color: '#60a5fa' }}>
                  Renews {fmtDate(subscription.renewalDate)}
                </p>
              )}
              {subscription.status === 'Cancelled' && subscription.endDate && (
                <p className="mt-0.5 text-xs" style={{ color: '#f43f5e' }}>
                  Active until {fmtDate(subscription.endDate)}
                </p>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-start gap-2">
          <div className="pt-1 text-right">
            <SubscriptionPriceValue amount={currentPrice.cost} currency={currentPrice.currency} fxRates={fxRates} />
            {history.length > 0 && (
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                current
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
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
                  onClick={onResubscribe}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: 'var(--muted)' }}
                  title="Resubscribe"
                  onMouseEnter={event => (event.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={event => (event.currentTarget.style.background = 'transparent')}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  onClick={onDelete}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: '#f43f5e' }}
                  title="Delete permanently"
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
      </div>

      {expanded && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
              Price history
            </p>
            <button
              onClick={onLogPriceChange}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}
            >
              + Price change
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-hover)' }}>
              <span style={{ color: 'var(--muted)' }}>Base price</span>
              <div className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
                <SubscriptionPriceValue amount={subscription.cost} currency={subscription.currency} fxRates={fxRates} />
              </div>
            </div>
            {history.length === 0 ? (
              <p className="px-1 py-2 text-xs" style={{ color: 'var(--muted)' }}>
                No price changes logged yet.
              </p>
            ) : (
              history.map(entry => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--surface-hover)' }}>
                  <span style={{ color: 'var(--muted)' }}>{fmtDate(entry.effectiveDate)}</span>
                  <div className="flex items-center gap-2">
                    <SubscriptionPriceValue amount={entry.cost} currency={entry.currency} fxRates={fxRates} />
                    <button
                      onClick={() => onRemovePriceHistory(entry.id)}
                      className="rounded p-1"
                      style={{ color: '#f43f5e' }}
                      title="Delete price change"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
