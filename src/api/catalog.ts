import type { Episode, Podcast } from '../types';
import { getPodcast as getApplePodcast, searchPodcasts as searchApple } from './itunes';
import { getNativePodcast, isNativeId, searchNativePodcasts } from './native';
import { getRssPodcast, isRssId } from './rss';

/** Un podcast du catalogue Apple, d'un créateur Podsal ou ajouté par son flux RSS. */
export function getAnyPodcast(
  id: string,
  country: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  if (isNativeId(id)) return getNativePodcast(id);
  if (isRssId(id)) return getRssPodcast(id, limit);
  return getApplePodcast(id, country, limit, signal);
}

/** Recherche combinée : créateurs Podsal d'abord, puis catalogue Apple. */
export async function searchAllPodcasts(term: string, country: string, signal?: AbortSignal): Promise<Podcast[]> {
  const [native, apple] = await Promise.all([searchNativePodcasts(term).catch(() => []), searchApple(term, country, signal)]);
  return [...native, ...apple];
}
