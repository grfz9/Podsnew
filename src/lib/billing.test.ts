// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { encodeForm, verifyStripeSignature } from '../../supabase/functions/_shared/stripe-core';

describe('Stripe', () => {
  it('encode les paramètres imbriqués comme l’API Stripe les attend', () => {
    expect(encodeForm({ mode: 'subscription', line_items: [{ price: 'price_1', quantity: 1 }], metadata: { user_id: 'u 1' }, skip: undefined })).toBe(
      'mode=subscription&line_items%5B0%5D%5Bprice%5D=price_1&line_items%5B0%5D%5Bquantity%5D=1&metadata%5Buser_id%5D=u%201',
    );
  });

  it('vérifie la signature des webhooks', async () => {
    const secret = 'whsec_test';
    const payload = '{"type":"customer.subscription.updated"}';
    const t = 1_800_000_000;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
    const sig = [...new Uint8Array(raw)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const now = t * 1000;
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, now)).toBe(true);
    expect(await verifyStripeSignature(payload + ' ', `t=${t},v1=${sig}`, secret, now)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'autre', now)).toBe(false);
    // Signature trop ancienne (rejeu).
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, now + 10 * 60_000)).toBe(false);
    expect(await verifyStripeSignature(payload, null, secret, now)).toBe(false);
  });
});
