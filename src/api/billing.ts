import { callFunction, supabase } from '../lib/supabase';

/* Abonnement Podsal+ (paiement Stripe, géré par les fonctions « billing » et « stripe-webhook »). */

export type Plan = 'monthly' | 'yearly';

export const PLANS: Record<Plan, { label: string; price: string; detail: string }> = {
  monthly: { label: 'Mensuel', price: '2,99 €', detail: 'par mois' },
  yearly: { label: 'Annuel', price: '24,99 €', detail: 'par an, soit 2,08 € par mois (−30 %)' },
};

export interface SubscriptionRow {
  status: string;
  plan: Plan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function isActive(sub: SubscriptionRow | null, now = new Date()): boolean {
  if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) return false;
  return !sub.current_period_end || new Date(sub.current_period_end) > now;
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .maybeSingle<SubscriptionRow>();
  if (error) throw new Error(error.message);
  return data;
}

/** Page vers laquelle Stripe renvoie après le paiement. */
const returnTo = () => `${location.origin}${location.pathname}#/premium`;

export async function startCheckout(plan: Plan): Promise<void> {
  const { url } = await callFunction<{ url: string }>('billing', { action: 'checkout', plan, returnTo: returnTo() });
  location.assign(url);
}

export async function openBillingPortal(): Promise<void> {
  const { url } = await callFunction<{ url: string }>('billing', { action: 'portal', returnTo: returnTo() });
  location.assign(url);
}
