import type { Episode } from '../types';
import { idbDelete, idbGetAll, idbPut } from './idb';

/** Nom du cache partagé avec le service worker (public/sw.js). */
export const AUDIO_CACHE = 'podsnew-audio-v1';

export interface DownloadRecord {
  id: string;
  episode: Episode;
  /**
   * blob  : fichier stocké dans IndexedDB (avance rapide possible hors-ligne) ;
   * cache : l'éditeur refuse les requêtes cross-origin, la réponse est gardée
   *         dans le cache du service worker qui la sert au lecteur.
   */
  mode: 'blob' | 'cache';
  blob?: Blob;
  size: number;
  createdAt: number;
}

export type DownloadInfo = Omit<DownloadRecord, 'blob'>;

class HttpError extends Error {}

/** Adresse locale jouable pour chaque épisode téléchargé (lue de façon synchrone par le lecteur). */
const localUrls = new Map<string, string>();
/** Vidéos importées : fichier complet pour l'image (le son de `localUrls` peut être la piste son seule). */
const videoUrls = new Map<string, string>();

export function localVideoUrlFor(episodeId: string): string | undefined {
  return videoUrls.get(episodeId);
}

export function registerLocalVideoUrl(id: string, url: string) {
  const previous = videoUrls.get(id);
  if (previous?.startsWith('blob:') && previous !== url) URL.revokeObjectURL(previous);
  videoUrls.set(id, url);
}

export function localUrlFor(episodeId: string): string | undefined {
  return localUrls.get(episodeId);
}

/** Fichiers importés (« Mes fichiers ») : lus par le lecteur comme un épisode téléchargé. */
export function registerLocalUrl(id: string, url: string) {
  const previous = localUrls.get(id);
  // L'adresse du fichier vidéo complet sert aussi à l'image : on ne la libère pas.
  if (previous?.startsWith('blob:') && previous !== url && previous !== videoUrls.get(id)) URL.revokeObjectURL(previous);
  localUrls.set(id, url);
}

export function unregisterLocalUrl(id: string) {
  const url = localUrls.get(id);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  localUrls.delete(id);
  const video = videoUrls.get(id);
  if (video?.startsWith('blob:') && video !== url) URL.revokeObjectURL(video);
  videoUrls.delete(id);
}

export function cachedAudioUrl(audioUrl: string): string {
  return new URL(`audio-cache?u=${encodeURIComponent(audioUrl)}`, document.baseURI).href;
}

function register(record: DownloadRecord) {
  if (record.mode === 'blob' && record.blob) {
    localUrls.set(record.id, URL.createObjectURL(record.blob));
  } else {
    // Fichier gardé dans le cache du service worker : lu via son adresse dédiée (voir public/sw.js).
    localUrls.set(record.id, cachedAudioUrl(record.episode.audioUrl));
  }
}

export async function loadDownloads(): Promise<DownloadInfo[]> {
  try {
    const records = await idbGetAll<DownloadRecord>('downloads');
    for (const r of records) if (!localUrls.has(r.id)) register(r);
    return records.map(({ blob: _blob, ...info }) => info);
  } catch {
    return [];
  }
}

async function readWithProgress(res: Response, onProgress: (ratio: number) => void): Promise<Blob> {
  const total = Number(res.headers.get('content-length')) || 0;
  const type = res.headers.get('content-type') || 'audio/mpeg';
  if (!res.body) return res.blob();
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total) onProgress(Math.min(0.99, received / total));
  }
  return new Blob(chunks, { type });
}

export async function downloadEpisode(
  episode: Episode,
  onProgress: (ratio: number) => void,
  signal: AbortSignal,
): Promise<DownloadInfo> {
  navigator.storage?.persist?.().catch(() => undefined);
  let record: DownloadRecord;
  try {
    const res = await fetch(episode.audioUrl, { mode: 'cors', signal });
    if (!res.ok) throw new HttpError(`Le serveur du podcast a répondu ${res.status}.`);
    const blob = await readWithProgress(res, onProgress);
    record = { id: episode.id, episode, mode: 'blob', blob, size: blob.size, createdAt: Date.now() };
  } catch (error) {
    if (signal.aborted || error instanceof HttpError) throw error;
    // Requête cross-origin refusée : on passe par le cache du service worker.
    if (!('caches' in window) || !navigator.serviceWorker?.controller) {
      throw new Error("Ce podcast n'autorise pas le téléchargement depuis le navigateur. Installez l'application pour contourner cette limite.");
    }
    onProgress(0.5);
    const res = await fetch(episode.audioUrl, { mode: 'no-cors', signal });
    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(episode.audioUrl, res);
    record = { id: episode.id, episode, mode: 'cache', size: 0, createdAt: Date.now() };
  }
  await idbPut('downloads', record);
  register(record);
  onProgress(1);
  const { blob: _blob, ...info } = record;
  return info;
}

export async function deleteDownload(info: DownloadInfo): Promise<void> {
  const url = localUrls.get(info.id);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  localUrls.delete(info.id);
  await idbDelete('downloads', info.id);
  if (info.mode === 'cache' && 'caches' in window) {
    const cache = await caches.open(AUDIO_CACHE);
    await cache.delete(info.episode.audioUrl);
  }
}
