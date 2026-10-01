/**
 * Appels à l'API Stripe sans bibliothèque (fetch + formulaire encodé) et vérification
 * de la signature des webhooks (HMAC SHA-256, en-tête « Stripe-Signature »).
 */
import { HttpError } from './http.ts';
import { encodeForm, type Params } from './stripe-core.ts';

export { verifyStripeSignature } from './stripe-core.ts';

const API = 'https://api.stripe.com/v1';

export async function stripe<T>(method: 'GET' | 'POST', path: string, params?: Params): Promise<T> {
  const key = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
  if (!key) throw new HttpError(503, "Le paiement n'est pas encore activé sur ce serveur.");
  const body = params ? encodeForm(params) : undefined;
  const url = method === 'GET' && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? body : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Erreur Stripe', res.status, data?.error?.message);
    throw new HttpError(502, 'Le service de paiement est indisponible.');
  }
  return data as T;
}
