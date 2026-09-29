import type { Episode, Podcast } from '../types';
import { getPodcast as getApplePodcast, searchPodcasts as searchApple } from './itunes';
import { getNativePodcast, isNativeId, searchNativePodcasts } from './native';

/** Un podcast du catalogue Apple ou d'un créateur Podsal. */
export function getAnyPodcast(
  id: string,
  country: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  return isNativeId(id) ? getNativePodcast(id) : getApplePodcast(id, country, limit, signal);
}

/** Recherche combinée : créateurs Podsal d'abord, puis catalogue Apple. */
export async function searchAllPodcasts(term: string, country: string, signal?: AbortSignal): Promise<Podcast[]> {
  const [native, apple] = await Promise.all([searchNativePodcasts(term).catch(() => []), searchApple(term, country, signal)]);
  return [...native, ...apple];
}
