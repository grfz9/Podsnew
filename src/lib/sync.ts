import type { Clip, DeviceStats, Episode, EpisodeProgress, Playlist, Podcast } from '../types';

/** Collections dont la dernière version l'emporte lors d'une synchronisation. */
export const LIST_KEYS = ['subscriptions', 'savedEpisodes', 'history', 'clips', 'playlists'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export interface SyncedData {
  subscriptions: Podcast[];
  savedEpisodes: Episode[];
  history: Episode[];
  clips: Clip[];
  playlists: Playlist[];
  progress: Record<string, EpisodeProgress>;
  stats: Record<string, DeviceStats>;
  /** Date de dernière modification de chaque collection. */
  modified: Record<ListKey, number>;
}

function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set(primary.map((x) => x.id));
  return [...primary, ...secondary.filter((x) => !seen.has(x.id))];
}

/**
 * Fusionne les données locales et distantes.
 * - Première synchronisation d'un appareil : union des listes (rien n'est perdu).
 * - Ensuite : pour chaque liste, la version modifiée le plus récemment l'emporte
 *   (ce qui propage aussi les suppressions).
 * - Progression : la plus récente par épisode. Statistiques : la plus récente par appareil.
 */
export function mergeSynced(local: SyncedData, remote: Partial<SyncedData>, firstSync: boolean): SyncedData {
  const out = { ...local, modified: { ...local.modified } } as SyncedData;
  const remoteModified = (remote.modified ?? {}) as Partial<Record<ListKey, number>>;

  for (const key of LIST_KEYS) {
    const remoteList = remote[key] as { id: string }[] | undefined;
    if (!remoteList) continue;
    const localList = local[key] as { id: string }[];
    const remoteAt = remoteModified[key] ?? 0;
    const localAt = local.modified[key] ?? 0;
    if (firstSync) {
      (out[key] as { id: string }[]) = unionById(localList, remoteList);
      out.modified[key] = Math.max(localAt, remoteAt);
    } else if (remoteAt > localAt) {
      (out[key] as { id: string }[]) = remoteList;
      out.modified[key] = remoteAt;
    }
  }

  const progress = { ...local.progress };
  for (const [id, p] of Object.entries(remote.progress ?? {})) {
    if (!progress[id] || p.updatedAt > progress[id].updatedAt) progress[id] = p;
  }
  out.progress = progress;

  const stats = { ...local.stats };
  for (const [device, s] of Object.entries(remote.stats ?? {})) {
    if (!stats[device] || s.updatedAt > stats[device].updatedAt) stats[device] = s;
  }
  out.stats = stats;

  return out;
}
