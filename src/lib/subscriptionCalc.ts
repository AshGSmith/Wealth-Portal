import type { ISODate, Subscription } from './types';

export type SubscriptionLifecycleAlert = {
  subscriptionId: string;
  subscriptionName: string;
  kind: 'contract' | 'renewal';
  date: ISODate;
  daysUntil: number;
};

const DAY_MS = 86_400_000;

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function currentIsoDate(): ISODate {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODate;
}

export function subscriptionCancellationCutoff(subscription: Subscription): ISODate | null {
  const dates = [subscription.endDate, subscription.contractEndDate].filter((date): date is ISODate => date !== null);
  return dates.sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
}

export function isCancelledSubscriptionActive(subscription: Subscription, asOfIso = currentIsoDate()): boolean {
  if (subscription.status !== 'Cancelled') return false;
  const cutoff = subscriptionCancellationCutoff(subscription);
  return cutoff !== null && cutoff >= asOfIso;
}

export function daysUntilIsoDate(date: ISODate, todayIso = currentIsoDate()): number {
  return Math.ceil((parseIsoDate(date).getTime() - parseIsoDate(todayIso).getTime()) / DAY_MS);
}

export function subscriptionLifecycleAlerts(
  subscriptions: Subscription[],
  todayIso = currentIsoDate(),
  daysAhead = 30,
): SubscriptionLifecycleAlert[] {
  return subscriptions
    .filter(subscription => !subscription.archived && !isCancelledSubscriptionActive(subscription, todayIso))
    .flatMap(subscription => {
      const alerts: SubscriptionLifecycleAlert[] = [];

      if (subscription.contractEndDate) {
        const daysUntil = daysUntilIsoDate(subscription.contractEndDate, todayIso);
        if (daysUntil >= 0 && daysUntil <= daysAhead) {
          alerts.push({
            subscriptionId: subscription.id as string,
            subscriptionName: subscription.name,
            kind: 'contract',
            date: subscription.contractEndDate,
            daysUntil,
          });
        }
      }

      if (subscription.renewalDate) {
        const daysUntil = daysUntilIsoDate(subscription.renewalDate, todayIso);
        if (daysUntil >= 0 && daysUntil <= daysAhead) {
          alerts.push({
            subscriptionId: subscription.id as string,
            subscriptionName: subscription.name,
            kind: 'renewal',
            date: subscription.renewalDate,
            daysUntil,
          });
        }
      }

      return alerts;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.subscriptionName.localeCompare(b.subscriptionName));
}
