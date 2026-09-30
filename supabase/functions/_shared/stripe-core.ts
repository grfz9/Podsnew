/**
 * Outils Stripe sans dépendance (utilisables côté serveur et dans les tests) :
 * encodage des paramètres de l'API et vérification de la signature des webhooks.
 */

export interface Params {
  [key: string]: string | number | boolean | undefined | null | Params | Params[];
}

/** { a: { b: 1 }, items: [{ price: 'x' }] } → a[b]=1&items[0][price]=x */
export function encodeForm(params: Params, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => parts.push(encodeForm(item, `${name}[${i}]`)));
    } else if (typeof value === 'object') {
      parts.push(encodeForm(value, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparaison à temps constant. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Vérifie « t=…,v1=… » : signature HMAC de « t.corps », tolérance de 5 minutes. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!header) return false;
  const fields = header.split(',').map((p) => p.split('=') as [string, string]);
  const timestamp = fields.find(([k]) => k === 't')?.[1];
  const signatures = fields.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some((s) => safeEqual(s, expected));
}
