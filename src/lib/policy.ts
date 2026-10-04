import type { Episode, Podcast } from '../types';

/**
 * Règles de contenu de Podsal, appli 100 % islamique :
 * - le Coran (récitations) est toujours proposé ;
 * - un podcast n'est proposé que s'il a été validé par la modération comme podcast islamique
 *   (catalogue, flux RSS importés et podcasts du Studio compris) ;
 * - tout le reste (podcasts généraux, musique, autres religions) est refusé ;
 * - la modération peut masquer n'importe quel podcast, même validé.
 */
export interface PolicyState {
  validated: Set<string>;
  blocked: Set<string>;
}

export const QURAN_PREFIX = 'quran-';

export const isQuranId = (podcastId: string) => podcastId.startsWith(QURAN_PREFIX);

export function allowsPodcast(p: Pick<Podcast, 'id'>, state: PolicyState): boolean {
  if (isQuranId(p.id)) return true;
  return state.validated.has(p.id) && !state.blocked.has(p.id);
}

export function allowsEpisode(e: Pick<Episode, 'podcastId'>, state: PolicyState): boolean {
  if (isQuranId(e.podcastId)) return true;
  return state.validated.has(e.podcastId) && !state.blocked.has(e.podcastId);
}

/** Contenu religieux (Coran ou podcast islamique validé) : pas de résumé automatique. */
export function isReligiousContent(podcastId: string, state: PolicyState): boolean {
  return isQuranId(podcastId) || state.validated.has(podcastId);
}
