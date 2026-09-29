import type { Episode, Podcast } from '../types';
import { rssEpisodeId, stableHash, type ParsedFeed } from '../../supabase/functions/_shared/podcast';
import { ISLAMIC_SEED } from '../data/islamicSeed';
import { getFeed } from '../lib/feed';
import { supabase } from '../lib/supabase';
import { isMusicGenre } from './genres';

/**
 * Podcasts ajoutés par leur flux RSS (absents du catalogue Apple Podcasts).
 * Leur identifiant est dérivé de l'adresse du flux : il est donc le même sur tous les appareils.
 */
export const RSS_PREFIX = 'rss-';

export const isRssId = (id: string) => id.startsWith(RSS_PREFIX);

export function normalizeFeedUrl(url: string): string {
  const u = new URL(url.trim());
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Adresse de flux invalide.');
  u.hash = '';
  return u.href;
}

export function rssPodcastId(feedUrl: string): string {
  return RSS_PREFIX + stableHash(normalizeFeedUrl(feedUrl));
}

/* Adresses des flux connus (liste de départ, podcasts validés). */
const feedUrls = new Map<string, string>();

export function registerFeed(id: string, feedUrl: string | undefined) {
  if (isRssId(id) && feedUrl) feedUrls.set(id, feedUrl);
}

for (const p of ISLAMIC_SEED) registerFeed(p.id, p.feedUrl);

async function resolveFeedUrl(id: string, hint?: string): Promise<string> {
  const known = feedUrls.get(id) ?? hint;
  if (known) return known;
  if (supabase) {
    const { data } = await supabase.from('islamic_podcasts').select('feed_url').eq('podcast_id', id).maybeSingle<{ feed_url: string | null }>();
    if (data?.feed_url) {
      registerFeed(id, data.feed_url);
      return data.feed_url;
    }
  }
  throw new Error('Podcast introuvable');
}

function mapFeed(id: string, feedUrl: string, feed: ParsedFeed): { podcast: Podcast; episodes: Episode[] } {
  const genre = feed.categories?.[0];
  const podcast: Podcast = {
    id,
    title: feed.title || feedUrl,
    author: feed.author ?? '',
    artwork: '',
    description: feed.description,
    feedUrl,
    genre,
    explicit: feed.explicit || undefined,
  };
  const episodes = feed.items
    .filter((item) => item.enclosureUrl)
    .map((item): Episode => {
      const date = item.pubDate ? new Date(item.pubDate) : null;
      return {
        id: rssEpisodeId(item),
        podcastId: id,
        podcastTitle: podcast.title,
        title: item.title || 'Sans titre',
        description: item.description ?? '',
        audioUrl: item.enclosureUrl!,
        duration: item.duration ?? 0,
        releaseDate: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
        artwork: '',
        guid: item.guid,
        genre,
        explicit: item.explicit,
      };
    })
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  return { podcast: { ...podcast, episodeCount: episodes.length, lastRelease: episodes[0]?.releaseDate }, episodes };
}

export async function getRssPodcast(id: string, limit = 100, feedUrlHint?: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  const feedUrl = await resolveFeedUrl(id, feedUrlHint);
  const { podcast, episodes } = mapFeed(id, feedUrl, await getFeed(feedUrl));
  return { podcast, episodes: episodes.slice(0, limit) };
}

/** Lecture d'un flux avant son ajout (page Modération). */
export async function previewFeed(url: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  const feedUrl = normalizeFeedUrl(url);
  const id = rssPodcastId(feedUrl);
  let feed: ParsedFeed;
  try {
    feed = await getFeed(feedUrl);
  } catch (error) {
    throw new Error(`Flux illisible : ${(error as Error).message}`);
  }
  const result = mapFeed(id, feedUrl, feed);
  if (!result.episodes.length) throw new Error('Ce flux ne contient aucun épisode audio.');
  if (feed.categories?.some((c) => isMusicGenre(c))) throw new Error("Ce flux est classé en musique : il ne peut pas être ajouté.");
  registerFeed(id, feedUrl);
  return result;
}
