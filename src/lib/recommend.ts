import type { DeviceStats, Episode, EpisodeProgress, Podcast } from '../types';
import { primaryGenreId } from '../api/genres';
import { dayKey, summarize } from './stats';

/** Générateur pseudo-aléatoire déterministe (même mix toute la journée). */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface MixInput {
  /** Derniers épisodes des podcasts suivis. */
  fromSubscriptions: Episode[];
  /** Épisodes de podcasts recommandés (découverte). */
  discovery: Episode[];
  progress: Record<string, EpisodeProgress>;
  date?: string;
  size?: number;
  maxDiscovery?: number;
}

/**
 * Mix du jour : épisodes récents non écoutés des abonnements (2 par podcast au plus),
 * complétés par quelques découvertes, dans un ordre qui change chaque jour.
 */
export function buildDailyMix({ fromSubscriptions, discovery, progress, date = dayKey(), size = 10, maxDiscovery = 3 }: MixInput): Episode[] {
  const fresh = (e: Episode) => {
    const p = progress[e.id];
    return !p || (!p.completed && p.position < 5);
  };
  const perPodcast = new Map<string, number>();
  const known = [...fromSubscriptions]
    .filter(fresh)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
    .filter((e) => {
      const n = perPodcast.get(e.podcastId) ?? 0;
      perPodcast.set(e.podcastId, n + 1);
      return n < 2;
    });

  const seenPodcasts = new Set(known.map((e) => e.podcastId));
  const discoveries: Episode[] = [];
  for (const e of discovery) {
    if (discoveries.length >= maxDiscovery) break;
    if (!fresh(e) || seenPodcasts.has(e.podcastId)) continue;
    seenPodcasts.add(e.podcastId);
    discoveries.push(e);
  }

  const random = seededRandom(date);
  const picked = [...known.slice(0, size - discoveries.length), ...discoveries];
  return shuffle(picked, random).slice(0, size);
}

export interface Seed {
  podcast: Pick<Podcast, 'id' | 'title'>;
  genreId: number;
}

/**
 * Podcasts servant de point de départ aux recommandations « Parce que vous écoutez… » :
 * les plus écoutés des 90 derniers jours, puis les abonnements ; une seule graine par catégorie.
 */
export function recommendationSeeds(
  stats: Record<string, DeviceStats>,
  subscriptions: Podcast[],
  max = 2,
  today: Date = new Date(),
): Seed[] {
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  const listened = summarize(stats, { from: dayKey(from) }).podcasts;
  const byId = new Map(subscriptions.map((p) => [p.id, p]));

  const candidates: { id: string; title: string; genre?: string; genreIds?: string[] }[] = [
    ...listened.map((l) => ({ id: l.item.id, title: l.item.title, genre: l.item.genre, genreIds: byId.get(l.item.id)?.genreIds })),
    ...subscriptions.map((p) => ({ id: p.id, title: p.title, genre: p.genre, genreIds: p.genreIds })),
  ];

  const seeds: Seed[] = [];
  const usedGenres = new Set<number>();
  const usedPodcasts = new Set<string>();
  for (const c of candidates) {
    if (seeds.length >= max) break;
    if (usedPodcasts.has(c.id)) continue;
    const genreId = primaryGenreId(c);
    if (!genreId || usedGenres.has(genreId)) continue;
    usedGenres.add(genreId);
    usedPodcasts.add(c.id);
    seeds.push({ podcast: { id: c.id, title: c.title }, genreId });
  }
  return seeds;
}

/** Retire ce que l'utilisateur connaît déjà d'une liste de podcasts recommandés. */
export function excludeKnown(podcasts: Podcast[], known: Set<string>): Podcast[] {
  return podcasts.filter((p) => !known.has(p.id));
}
