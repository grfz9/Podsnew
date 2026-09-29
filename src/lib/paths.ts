import type { Episode } from '../types';
import { isQuranId, QURAN_PREFIX } from './policy';

/** Page d'un podcast (ou d'un récitateur pour le Coran). */
export function podcastPath(podcastId: string): string {
  return isQuranId(podcastId) ? `/coran/${podcastId.slice(QURAN_PREFIX.length)}` : `/podcast/${podcastId}`;
}

/** Page d'un épisode (ou d'une sourate récitée). */
export function episodePath(e: Pick<Episode, 'podcastId' | 'id'>): string {
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
