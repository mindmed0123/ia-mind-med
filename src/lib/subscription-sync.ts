import { supabase } from '@/integrations/supabase/client';

/** Minimum interval between Stripe confirmations for the same user in one browser. */
export const STRIPE_SYNC_INTERVAL_MS = 30 * 60 * 1000;

export interface SyncableRow {
  status?: string | null;
  plan_origem?: string | null;
  trial_end?: string | null;
  stripe_subscription_id?: string | null;
}

export function rowHasAccess(row: SyncableRow | null | undefined, now = Date.now()): boolean {
  if (!row) return false;
  if (row.status === 'ACTIVE') return true;
  if (row.status !== 'TRIALING') return false;
  return !row.trial_end || new Date(row.trial_end).getTime() >= now;
}

/**
 * Whether the app should ask Stripe for the real subscription state:
 * always when access would be denied, and periodically for Stripe-linked rows.
 * Courtesy (admin-granted) access never depends on Stripe.
 */
export function needsStripeSync(
  row: SyncableRow | null | undefined,
  lastSyncAt: number | null,
  now = Date.now(),
): boolean {
  if (row?.plan_origem === 'courtesy_admin') return false;
  if (lastSyncAt && now - lastSyncAt < STRIPE_SYNC_INTERVAL_MS) return false;
  return !rowHasAccess(row, now) || !!row?.stripe_subscription_id;
}

const key = (userId: string) => `mm_sub_sync_${userId}`;

export function lastStripeSync(userId: string): number | null {
  try {
    const v = Number(sessionStorage.getItem(key(userId)));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export interface StripeSyncResult {
  synced: boolean;
  status?: string | null;
  trial?: boolean;
}

/** Asks the server to mirror the Stripe subscription onto the account. Never throws. */
export async function syncSubscriptionWithStripe(userId: string): Promise<StripeSyncResult | null> {
  try {
    sessionStorage.setItem(key(userId), String(Date.now()));
  } catch { /* private mode */ }
  try {
    const { data, error } = await supabase.functions.invoke('sync-subscription', { body: {} });
    if (error || !data) return null;
    return data as StripeSyncResult;
  } catch {
    return null;
  }
}
