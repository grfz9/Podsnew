// Abonnement Podsal+ : ouverture du paiement Stripe (Checkout) et de l'espace client (gestion, résiliation).
import { adminClient, HttpError, json, readJson, requireUser, serve } from '../_shared/http.ts';
import { stripe } from '../_shared/stripe.ts';

const PRICES = {
  monthly: () => Deno.env.get('STRIPE_PRICE_MONTHLY'),
  yearly: () => Deno.env.get('STRIPE_PRICE_YEARLY'),
};

/** Seules les adresses de l'application (APP_URLS, séparées par des virgules) sont acceptées comme retour après paiement. */
function returnUrl(raw: unknown): string {
  const allowed = (Deno.env.get('APP_URLS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((u) => {
      try {
        return new URL(u.trim()).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (typeof raw !== 'string') throw new HttpError(400, 'Adresse de retour manquante.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'Adresse de retour invalide.');
  }
  if (!allowed.includes(url.origin)) throw new HttpError(400, 'Adresse de retour non autorisée.');
  return url.href;
}

serve(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'Méthode non autorisée.');
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await readJson<{ action?: string; plan?: 'monthly' | 'yearly'; returnTo?: string }>(req);
  const back = returnUrl(body.returnTo);

  const { data: row } = await admin.from('subscriptions').select('stripe_customer_id, status').eq('user_id', user.id).maybeSingle();

  if (body.action === 'portal') {
    if (!row?.stripe_customer_id) throw new HttpError(404, 'Aucun abonnement à gérer.');
    const session = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer: row.stripe_customer_id, return_url: back });
    return json({ url: session.url });
  }

  if (body.action !== 'checkout') throw new HttpError(400, 'Action inconnue.');
  if (row && ['active', 'trialing', 'past_due'].includes(row.status)) throw new HttpError(409, 'Vous êtes déjà abonné à Podsal+.');
  const plan = body.plan === 'yearly' ? 'yearly' : 'monthly';
  const price = PRICES[plan]();
  if (!price) throw new HttpError(503, "Le paiement n'est pas encore activé sur ce serveur.");

  // Client Stripe réutilisé d'un abonnement à l'autre.
  let customer = row?.stripe_customer_id as string | undefined;
  if (!customer) {
    const { data: auth } = await admin.auth.admin.getUserById(user.id);
    const created = await stripe<{ id: string }>('POST', '/customers', {
      email: auth.user?.email ?? undefined,
      phone: auth.user?.phone ? `+${auth.user.phone.replace(/^\+/, '')}` : undefined,
      metadata: { user_id: user.id },
    });
    customer = created.id;
    await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customer, updated_at: new Date().toISOString() });
  }

  const separator = back.includes('?') ? '&' : '?';
  const session = await stripe<{ url: string }>('POST', '/checkout/sessions', {
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id, plan } },
    allow_promotion_codes: true,
    locale: 'fr',
    success_url: `${back}${separator}paiement=ok`,
    cancel_url: `${back}${separator}paiement=annule`,
  });
  return json({ url: session.url });
});
