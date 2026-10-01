import { idbDelete, idbGet, idbPut } from './idb';

/**
 * Adhan joué à l'heure de la prière (désactivé par défaut).
 * - « default » : adhan récité par Aaqib Azeez (Wikimedia Commons, licence CC BY-SA 4.0),
 *   téléchargé une fois sur l'appareil quand l'utilisateur l'active, puis disponible hors-ligne ;
 * - « custom » : fichier audio choisi par l'utilisateur, gardé sur l'appareil.
 */
export type AdhanChoice = 'off' | 'default' | 'custom';

export const DEFAULT_ADHAN_URL = 'https://upload.wikimedia.org/wikipedia/commons/7/7d/The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3';
export const DEFAULT_ADHAN_CREDIT = {
  reciter: 'Aaqib Azeez',
  author: 'Atcovi',
  license: 'CC BY-SA 4.0',
  source: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
};
const MAX_CUSTOM_BYTES = 20 * 1024 * 1024;

interface StoredAdhan {
  blob: Blob;
  name: string;
}

const key = (kind: 'default' | 'custom') => `adhan:${kind}`;

export async function getAdhan(kind: 'default' | 'custom'): Promise<StoredAdhan | undefined> {
  return idbGet<StoredAdhan>('kv', key(kind)).catch(() => undefined);
}

/** Télécharge l'adhan par défaut sur l'appareil (une seule fois). */
export async function downloadDefaultAdhan(): Promise<StoredAdhan> {
  const existing = await getAdhan('default');
  if (existing) return existing;
  let res: Response;
  try {
    res = await fetch(DEFAULT_ADHAN_URL, { mode: 'cors' });
  } catch {
    throw new Error('Téléchargement de l’adhan impossible : vérifiez votre connexion.');
  }
  if (!res.ok) throw new Error('Téléchargement de l’adhan impossible pour le moment.');
  const stored = { blob: await res.blob(), name: `Adhan – ${DEFAULT_ADHAN_CREDIT.reciter}` };
  await idbPut('kv', stored, key('default'));
  return stored;
}

export async function importCustomAdhan(file: File): Promise<StoredAdhan> {
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/i.test(file.name);
  if (!isAudio) throw new Error('Choisissez un fichier audio (MP3, M4A, WAV…).');
  if (file.size > MAX_CUSTOM_BYTES) throw new Error('Fichier trop lourd (20 Mo maximum).');
  const stored = { blob: file, name: file.name.replace(/\.[^.]+$/, '') || 'Mon adhan' };
  await idbPut('kv', stored, key('custom'));
  return stored;
}

export async function deleteCustomAdhan(): Promise<void> {
  await idbDelete('kv', key('custom'));
}

/* ---------- Lecture ---------- */

let element: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
const listeners = new Set<(playing: boolean) => void>();

function emit(playing: boolean) {
  listeners.forEach((l) => l(playing));
}

/** Prévenu quand l'adhan commence ou s'arrête (bannière, bouton d'aperçu). */
export function onAdhanChange(listener: (playing: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isAdhanPlaying(): boolean {
  return !!element && !element.paused;
}

/** Joue l'adhan choisi. Renvoie false s'il n'est pas disponible sur l'appareil. */
export async function playAdhan(kind: 'default' | 'custom'): Promise<boolean> {
  const stored = kind === 'default' ? await downloadDefaultAdhan().catch(() => undefined) : await getAdhan('custom');
  if (!stored) return false;
  stopAdhan();
  if (!element) {
    element = document.createElement('audio');
    element.setAttribute('playsinline', '');
    element.hidden = true;
    document.body.appendChild(element);
    element.addEventListener('ended', () => emit(false));
    element.addEventListener('pause', () => emit(false));
    element.addEventListener('play', () => emit(true));
  }
  currentUrl = URL.createObjectURL(stored.blob);
  element.src = currentUrl;
  element.currentTime = 0;
  try {
    await element.play();
    return true;
  } catch {
    // Lecture refusée (navigateur qui exige une action de l'utilisateur) : la bannière reste affichée.
    return false;
  }
}

export function stopAdhan() {
  if (!element) return;
  element.pause();
  element.removeAttribute('src');
  element.load();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  emit(false);
}
