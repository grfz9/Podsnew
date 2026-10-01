// Webhook Stripe : tient à jour la table « subscriptions » (seule source de vérité de Podsal+).
import { adminClient, HttpError, json, serve } from '../_shared/http.ts';
import { stripe, verifyStripeSignature } from '../_shared/stripe.ts';

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end?: number;
  items?: { data: { current_period_end?: number; price?: { recurring?: { interval?: string } } }[] };
  metadata?: { user_id?: string; plan?: string };
}

const STATUSES = new Set(['trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']);

async function saveSubscription(sub: StripeSubscription) {
  const admin = adminClient();
  // Retrouve l'utilisateur par les métadonnées, sinon par le client Stripe.
  let userId = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', sub.customer).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) {
    console.warn('Abonnement sans utilisateur connu', sub.id);
    return;
  }
  const item = sub.items?.data?.[0];
  const periodEnd = sub.current_period_end ?? item?.current_period_end;
  const interval = item?.price?.recurring?.interval;
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: STATUSES.has(sub.status) ? sub.status : 'none',
    plan: interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : (sub.metadata?.plan ?? null),
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  // .trim() : un espace ou un retour à la ligne collé avec la clé ferait échouer toutes les signatures.
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
  if (!secret) throw new HttpError(503, 'Webhook non configuré.');
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), secret))) throw new HttpError(400, 'Signature invalide.');

  const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as { subscription?: string };
      if (session.subscription) await saveSubscription(await stripe<StripeSubscription>('GET', `/subscriptions/${session.subscription}`));
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      await saveSubscription(event.data.object as unknown as StripeSubscription);
      break;
  }
  return json({ received: true });
});
