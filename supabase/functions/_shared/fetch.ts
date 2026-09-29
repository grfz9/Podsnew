import { HttpError } from './http.ts';

/** Refuse les adresses internes (protection contre les requêtes vers le réseau privé). */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (h.includes(':')) return h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, 'Adresse invalide.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(400, 'Seules les adresses http(s) sont acceptées.');
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new HttpError(400, 'Adresse non autorisée.');
  return url;
}

/**
 * Télécharge un fichier texte distant avec limites de taille, de durée et de redirections.
 * Chaque redirection est vérifiée (pas de rebond vers une adresse interne).
 */
export async function fetchText(raw: string, maxBytes = 8_000_000, timeoutMs = 15_000): Promise<{ body: string; type: string }> {
  let url = checkUrl(raw);
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'Podsnew/1.0 (+https://github.com/grfz9/Podsnew)' } });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel();
      if (!location) throw new HttpError(502, 'Redirection invalide.');
      url = checkUrl(new URL(location, url).href);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new HttpError(502, `Le serveur distant a répondu ${res.status}.`);
    }
    const declared = Number(res.headers.get('content-length'));
    if (declared > maxBytes) {
      await res.body?.cancel();
      throw new HttpError(413, 'Fichier trop volumineux.');
    }
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, 'Fichier trop volumineux.');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return { body: new TextDecoder().decode(bytes), type: res.headers.get('content-type') ?? '' };
  }
  throw new HttpError(502, 'Trop de redirections.');
}
