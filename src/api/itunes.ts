import type { Episode, Podcast } from '../types';

/**
 * Catalogue de podcasts basé sur l'API publique d'Apple (iTunes Search API) :
 * gratuite, sans clé, et accessible directement depuis le navigateur (CORS).
 */
const BASE = 'https://itunes.apple.com';

/* ---------- Formes brutes renvoyées par l'API ---------- */

export interface RawPodcast {
  wrapperType?: string;
  kind?: string;
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100?: string;
  artworkUrl600?: string;
  primaryGenreName?: string;
  feedUrl?: string;
  trackCount?: number;
  releaseDate?: string;
}

export interface RawEpisode {
  wrapperType: 'podcastEpisode';
  trackId: number;
  trackName: string;
  collectionId: number;
  collectionName: string;
  description?: string;
  shortDescription?: string;
  episodeUrl?: string;
  trackTimeMillis?: number;
  releaseDate: string;
  artworkUrl600?: string;
  artworkUrl160?: string;
}

interface RawChartEntry {
  id: { attributes: { 'im:id': string } };
  'im:name': { label: string };
  'im:artist'?: { label: string };
  'im:image'?: { label: string }[];
  summary?: { label: string };
  category?: { attributes: { label: string } };
  'im:releaseDate'?: { label: string };
}

/* ---------- Conversions vers nos types ---------- */

/** Demande une pochette plus grande que celle fournie par défaut. */
export function upscaleArtwork(url: string | undefined, size = 600): string {
  if (!url) return '';
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/, `/${size}x${size}bb.$2`);
}

export function mapPodcast(raw: RawPodcast): Podcast {
  return {
    id: String(raw.collectionId),
    title: raw.collectionName,
    author: raw.artistName,
    artwork: raw.artworkUrl600 || upscaleArtwork(raw.artworkUrl100),
    genre: raw.primaryGenreName,
    feedUrl: raw.feedUrl,
    episodeCount: raw.trackCount,
    lastRelease: raw.releaseDate,
  };
}

export function mapEpisode(raw: RawEpisode, fallbackArtwork = ''): Episode | null {
  if (!raw.episodeUrl) return null;
  return {
    id: String(raw.trackId),
    podcastId: String(raw.collectionId),
    podcastTitle: raw.collectionName,
    title: raw.trackName,
    description: (raw.description || raw.shortDescription || '').trim(),
    audioUrl: raw.episodeUrl,
    duration: raw.trackTimeMillis ? Math.round(raw.trackTimeMillis / 1000) : 0,
    releaseDate: raw.releaseDate,
    artwork: raw.artworkUrl600 || fallbackArtwork,
  };
}

export function mapChartEntry(entry: RawChartEntry): Podcast {
  const images = entry['im:image'] ?? [];
  return {
    id: entry.id.attributes['im:id'],
    title: entry['im:name'].label,
    author: entry['im:artist']?.label ?? '',
    artwork: upscaleArtwork(images[images.length - 1]?.label),
    genre: entry.category?.attributes.label,
    description: entry.summary?.label,
  };
}

/* ---------- Requêtes ---------- */

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
  return res.json() as Promise<T>;
}

export async function searchPodcasts(term: string, country: string, signal?: AbortSignal): Promise<Podcast[]> {
  const params = new URLSearchParams({ media: 'podcast', entity: 'podcast', term, country, limit: '30' });
  const data = await getJson<{ results: RawPodcast[] }>(`${BASE}/search?${params}`, signal);
  return data.results.filter((r) => r.collectionId).map(mapPodcast);
}

export async function searchEpisodes(term: string, country: string, signal?: AbortSignal): Promise<Episode[]> {
  const params = new URLSearchParams({ media: 'podcast', entity: 'podcastEpisode', term, country, limit: '25' });
  const data = await getJson<{ results: RawEpisode[] }>(`${BASE}/search?${params}`, signal);
  return data.results.map((r) => mapEpisode(r)).filter((e): e is Episode => e !== null);
}

/** Classement des podcasts les plus écoutés, éventuellement par catégorie. */
export async function getTopPodcasts(country: string, genreId?: number, limit = 30, signal?: AbortSignal): Promise<Podcast[]> {
  const genre = genreId ? `/genre=${genreId}` : '';
  const url = `${BASE}/${country}/rss/toppodcasts/limit=${limit}${genre}/json`;
  const data = await getJson<{ feed: { entry?: RawChartEntry | RawChartEntry[] } }>(url, signal);
  const entries = data.feed.entry;
  if (!entries) return [];
  return (Array.isArray(entries) ? entries : [entries]).map(mapChartEntry);
}

export async function getPodcast(
  id: string,
  country: string,
  limit = 100,
  signal?: AbortSignal,
): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  const params = new URLSearchParams({ id, entity: 'podcastEpisode', limit: String(limit), country });
  const data = await getJson<{ results: (RawPodcast | RawEpisode)[] }>(`${BASE}/lookup?${params}`, signal);
  const rawPodcast = data.results.find((r): r is RawPodcast => r.wrapperType !== 'podcastEpisode');
  if (!rawPodcast) throw new Error('Podcast introuvable');
  const podcast = mapPodcast(rawPodcast);
  const episodes = data.results
    .filter((r): r is RawEpisode => r.wrapperType === 'podcastEpisode')
    .map((r) => mapEpisode(r, podcast.artwork))
    .filter((e): e is Episode => e !== null)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  return { podcast, episodes };
}
