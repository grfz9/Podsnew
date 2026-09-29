import type { Episode, Podcast } from '../types';
import { isMusicGenre, isMusicPodcast, isReligiousGenre, isReligiousPodcast } from '../api/genres';

/**
 * Règles de contenu de Podsal :
 * - pas de musique, pas de contenu explicite ;
 * - pas de podcasts religieux dans le catalogue général (autres religions, ou islam non validé) ;
 * - les podcasts islamiques ne sont proposés que s'ils ont été validés par la modération ;
 * - la modération peut masquer n'importe quel podcast du catalogue.
 */
export interface PolicyState {
  validated: Set<string>;
  blocked: Set<string>;
}

export const QURAN_PREFIX = 'quran-';

export const isQuranId = (podcastId: string) => podcastId.startsWith(QURAN_PREFIX);

export function allowsPodcast(p: Pick<Podcast, 'id' | 'genre' | 'genreIds' | 'explicit'>, state: PolicyState): boolean {
  if (isQuranId(p.id)) return true;
  if (state.blocked.has(p.id)) return false;
  if (state.validated.has(p.id)) return true;
  if (p.explicit || isMusicPodcast(p)) return false;
  return !isReligiousPodcast(p);
}

export function allowsEpisode(e: Pick<Episode, 'podcastId' | 'genre' | 'explicit'>, state: PolicyState): boolean {
  if (isQuranId(e.podcastId)) return true;
  if (state.blocked.has(e.podcastId)) return false;
  if (state.validated.has(e.podcastId)) return true;
  if (e.explicit || isMusicGenre(e.genre)) return false;
  return !isReligiousGenre(e.genre);
}

/** Contenu religieux (Coran ou podcast islamique validé) : pas de résumé automatique. */
export function isReligiousContent(podcastId: string, state: PolicyState): boolean {
  return isQuranId(podcastId) || state.validated.has(podcastId);
}
