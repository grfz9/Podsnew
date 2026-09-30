import type { Episode } from '../types';
import { LOCAL_PODCAST_ID } from './localFiles';
import { isQuranId, QURAN_PREFIX } from './policy';

/** Page des fichiers importés par l'utilisateur. */
export const LOCAL_FILES_PATH = '/fichiers';

/** Page d'un podcast (ou d'un récitateur pour le Coran). */
export function podcastPath(podcastId: string): string {
  if (podcastId === LOCAL_PODCAST_ID) return LOCAL_FILES_PATH;
  return isQuranId(podcastId) ? `/coran/${podcastId.slice(QURAN_PREFIX.length)}` : `/podcast/${podcastId}`;
}

/** Page d'un épisode (ou d'une sourate récitée). */
export function episodePath(e: Pick<Episode, 'podcastId' | 'id'>): string {
  if (e.podcastId === LOCAL_PODCAST_ID) return LOCAL_FILES_PATH;
  if (isQuranId(e.podcastId)) {
    const m = e.id.match(/^q-(\d+)-(\d+)$/);
    const reciter = e.podcastId.slice(QURAN_PREFIX.length);
    return m ? `/coran/${reciter}/${m[2]}?m=${m[1]}` : `/coran/${reciter}`;
  }
  return `/podcast/${e.podcastId}/episode/${e.id}`;
}

export function absoluteUrl(path: string): string {
  return `${location.origin}${location.pathname}#${path}`;
}
