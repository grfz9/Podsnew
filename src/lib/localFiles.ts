import type { Episode } from '../types';
import { registerLocalUrl, unregisterLocalUrl } from './downloads';
import { idbDelete, idbGet, idbGetAll, idbPut } from './idb';

/**
 * « Mes fichiers » : fichiers audio et vidéo importés depuis l'appareil (MP3, M4A, MP4…).
 * Ils sont gardés dans IndexedDB, uniquement sur l'appareil, et lus par le lecteur comme
 * des épisodes : lecture en arrière-plan, écran verrouillé, vitesse, file d'attente…
 */
export const LOCAL_PODCAST_ID = 'local';
export const LOCAL_PODCAST_TITLE = 'Mes fichiers';
const ID_PREFIX = 'file-';

export interface LocalFileRecord {
  id: string;
  title: string;
  kind: 'audio' | 'video';
  mime: string;
  size: number;
  /** Durée en secondes (0 si le navigateur n'a pas pu la lire). */
  duration: number;
  createdAt: number;
  blob: Blob;
}

export type LocalFile = Omit<LocalFileRecord, 'blob'>;

const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'weba'];
const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', 'mkv', '3gp'];

/** Valeur de l'attribut `accept` du sélecteur de fichiers. */
export const ACCEPTED_FILES = ['audio/*', 'video/*', ...[...AUDIO_EXT, ...VIDEO_EXT].map((e) => `.${e}`)].join(',');

export function isLocalId(id: string): boolean {
  return id.startsWith(ID_PREFIX);
}

function extension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/** Audio, vidéo, ou null si le fichier n'est pas un média. */
export function mediaKindOf(file: { name: string; type: string }): 'audio' | 'video' | null {
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  const ext = extension(file.name);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

/** Titre lisible à partir du nom du fichier (« cours_tafsir-01.mp3 » → « cours tafsir-01 »). */
export function titleFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
  return base || 'Fichier sans nom';
}

export function toEpisode(file: LocalFile): Episode {
  return {
    id: file.id,
    podcastId: LOCAL_PODCAST_ID,
    podcastTitle: LOCAL_PODCAST_TITLE,
    title: file.title,
    description: '',
    audioUrl: '',
    duration: file.duration,
    releaseDate: new Date(file.createdAt).toISOString(),
    artwork: '',
    mediaKind: file.kind,
  };
}

/** Durée lue dans les métadonnées du fichier (quelques secondes au plus). */
function readDuration(url: string, kind: 'audio' | 'video'): Promise<number> {
  return new Promise((resolve) => {
    const media = document.createElement(kind);
    media.preload = 'metadata';
    const done = (value: number) => {
      clearTimeout(timer);
      media.removeAttribute('src');
      media.load();
      resolve(value);
    };
    const timer = setTimeout(() => done(0), 8000);
    media.onloadedmetadata = () => done(Number.isFinite(media.duration) ? media.duration : 0);
    media.onerror = () => done(0);
    media.src = url;
  });
}

export async function loadLocalFiles(): Promise<LocalFile[]> {
  try {
    const records = await idbGetAll<LocalFileRecord>('files');
    for (const r of records) registerLocalUrl(r.id, URL.createObjectURL(r.blob));
    return records.map(({ blob: _blob, ...info }) => info).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function importLocalFile(file: File): Promise<LocalFile> {
  const kind = mediaKindOf(file);
  if (!kind) throw new Error(`« ${file.name} » n’est pas un fichier audio ou vidéo.`);
  navigator.storage?.persist?.().catch(() => undefined);
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  if (estimate?.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < file.size * 1.1) {
    throw new Error(`Pas assez d’espace sur l’appareil pour « ${file.name} ».`);
  }
  const url = URL.createObjectURL(file);
  const duration = await readDuration(url, kind);
  const record: LocalFileRecord = {
    id: `${ID_PREFIX}${crypto.randomUUID()}`,
    title: titleFromName(file.name),
    kind,
    mime: file.type || (kind === 'audio' ? 'audio/mpeg' : 'video/mp4'),
    size: file.size,
    duration,
    createdAt: Date.now(),
    blob: file,
  };
  try {
    await idbPut('files', record);
  } catch (error) {
    URL.revokeObjectURL(url);
    throw (error as DOMException)?.name === 'QuotaExceededError'
      ? new Error(`Pas assez d’espace sur l’appareil pour « ${file.name} ».`)
      : new Error(`Impossible d’enregistrer « ${file.name} ».`);
  }
  registerLocalUrl(record.id, url);
  const { blob: _blob, ...info } = record;
  return info;
}

export async function renameLocalFile(id: string, title: string): Promise<void> {
  const record = await idbGet<LocalFileRecord>('files', id);
  if (!record) return;
  await idbPut('files', { ...record, title });
}

export async function deleteLocalFile(id: string): Promise<void> {
  unregisterLocalUrl(id);
  await idbDelete('files', id);
}

/* ---------- Groupes ---------- */

/** Groupe de fichiers (sur l'appareil). `remoteId` : groupe publié sur le profil (visible par les amis). */
export interface FileGroup {
  id: string;
  name: string;
  fileIds: string[];
  createdAt: number;
  /** Dernière modification (nom, fichiers, ordre, titres) : sert à savoir si la publication est à jour. */
  updatedAt: number;
  remoteId?: string;
  publishedAt?: number;
}

const GROUPS_KEY = 'file-groups';

export async function loadGroups(): Promise<FileGroup[]> {
  try {
    return (await idbGet<FileGroup[]>('kv', GROUPS_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function saveGroups(groups: FileGroup[]): Promise<void> {
  await idbPut('kv', groups, GROUPS_KEY);
}

/** Fichier complet (pour l'envoyer lors d'une publication). */
export async function getLocalFileBlob(id: string): Promise<Blob | undefined> {
  return (await idbGet<LocalFileRecord>('files', id))?.blob;
}

export function newGroupId(): string {
  return `group-${crypto.randomUUID()}`;
}

/** La publication ne reflète plus le groupe (fichiers, ordre, noms modifiés depuis). */
export function isPublicationOutdated(group: FileGroup): boolean {
  return !!group.remoteId && (group.publishedAt ?? 0) < group.updatedAt;
}
