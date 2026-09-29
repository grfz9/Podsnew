import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.ts';
import { fetchText } from './fetch.ts';
import { findItem, parseFeed, parseTranscript, pickTranscript, rssEpisodeId, transcriptToText, type ParsedSegment } from './podcast.ts';

/** Épisode tel que stocké côté client (voir src/types.ts). */
export interface EpisodeData {
  id: string;
  podcastId: string;
  podcastTitle: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  releaseDate: string;
  artwork: string;
  guid?: string;
}

export interface PodcastData {
  id: string;
  title: string;
  feedUrl?: string;
}

const MUSIC_GENRES = new Set(['1310', '1523', '1524', '1525']);

/** Retrouve un épisode et son podcast (catalogue Apple, créateur Podsal ou flux RSS validé) à partir des identifiants. */
export async function loadEpisode(
  admin: SupabaseClient,
  podcastId: string,
  episodeId: string,
  country = 'fr',
): Promise<{ podcast: PodcastData; episode: EpisodeData }> {
  if (!/^[\w-]{1,64}$/.test(podcastId) || !/^[\w-]{1,64}$/.test(episodeId) || !/^[a-z]{2}$/.test(country)) {
    throw new HttpError(400, 'Identifiants invalides.');
  }

  if (podcastId.startsWith('c-')) {
    const { data: row } = await admin
      .from('creator_episodes')
      .select('*, creator_podcasts(id, title, cover_url)')
      .eq('id', episodeId.slice(2))
      .lte('published_at', new Date().toISOString())
      .maybeSingle();
    if (!row || `c-${row.podcast_id}` !== podcastId) throw new HttpError(404, 'Épisode introuvable.');
    const p = row.creator_podcasts as { id: string; title: string; cover_url: string | null };
    return {
      podcast: { id: podcastId, title: p.title },
      episode: {
        id: episodeId,
        podcastId,
        podcastTitle: p.title,
        title: row.title,
        description: row.description,
        audioUrl: row.audio_url,
        duration: row.duration,
        releaseDate: row.published_at,
        artwork: p.cover_url ?? '',
        guid: row.id,
      },
    };
  }

  if (podcastId.startsWith('rss-')) {
    // Seuls les flux validés par la modération sont connus du serveur.
    const { data: row } = await admin.from('islamic_podcasts').select('title, feed_url').eq('podcast_id', podcastId).maybeSingle();
    if (!row?.feed_url) throw new HttpError(404, 'Podcast introuvable.');
    const feed = parseFeed((await fetchText(row.feed_url, 15_000_000)).body);
    const item = feed.items.find((i) => i.enclosureUrl && rssEpisodeId(i) === episodeId);
    if (!item) throw new HttpError(404, 'Épisode introuvable.');
    const title = feed.title || row.title;
    const date = item.pubDate ? new Date(item.pubDate) : null;
    return {
      podcast: { id: podcastId, title, feedUrl: row.feed_url },
      episode: {
        id: episodeId,
        podcastId,
        podcastTitle: title,
        title: item.title,
        description: item.description ?? '',
        audioUrl: item.enclosureUrl!,
        duration: item.duration ?? 0,
        releaseDate: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
        artwork: '',
        guid: item.guid,
      },
    };
  }

  const params = new URLSearchParams({ id: podcastId, entity: 'podcastEpisode', limit: '200', country });
  const res = await fetch(`https://itunes.apple.com/lookup?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, 'Catalogue indisponible.');
  const data = (await res.json()) as { results: Record<string, unknown>[] };
  const raw = data.results.find((r) => r.wrapperType !== 'podcastEpisode');
  if (!raw) throw new HttpError(404, 'Podcast introuvable.');
  if ((raw.genreIds as string[] | undefined)?.some((g) => MUSIC_GENRES.has(g))) throw new HttpError(404, 'Podcast introuvable.');
  const e = data.results.find((r) => r.wrapperType === 'podcastEpisode' && String(r.trackId) === episodeId);
  if (!e || typeof e.episodeUrl !== 'string') throw new HttpError(404, 'Épisode introuvable.');
  return {
    podcast: { id: podcastId, title: String(raw.collectionName), feedUrl: raw.feedUrl as string | undefined },
    episode: {
      id: episodeId,
      podcastId,
      podcastTitle: String(raw.collectionName),
      title: String(e.trackName),
      description: String(e.description ?? e.shortDescription ?? ''),
      audioUrl: e.episodeUrl,
      duration: e.trackTimeMillis ? Math.round(Number(e.trackTimeMillis) / 1000) : 0,
      releaseDate: String(e.releaseDate),
      artwork: String(e.artworkUrl600 ?? raw.artworkUrl600 ?? ''),
      guid: e.episodeGuid as string | undefined,
    },
  };
}

/** Transcription déjà indexée, ou récupérée depuis le flux RSS puis indexée. */
export async function getOrIndexTranscript(
  admin: SupabaseClient,
  podcast: PodcastData,
  episode: EpisodeData,
): Promise<ParsedSegment[] | null> {
  const { data: existing } = await admin.from('transcripts').select('segments').eq('episode_id', episode.id).maybeSingle();
  if (existing) return existing.segments as ParsedSegment[];
  if (!podcast.feedUrl) return null;

  const feed = parseFeed((await fetchText(podcast.feedUrl, 15_000_000)).body);
  const item = findItem(feed, episode);
  const ref = item && pickTranscript(item.transcripts, 'fr');
  if (!ref) return null;

  const { body, type } = await fetchText(ref.url, 5_000_000);
  const segments = parseTranscript(body, ref.type || type);
  if (segments.length === 0) return null;

  const { description: _d, ...meta } = episode;
  await admin.from('transcripts').upsert({
    episode_id: episode.id,
    podcast_id: podcast.id,
    episode: { ...meta, description: episode.description.slice(0, 600) },
    source_url: ref.url,
    segments,
    content: transcriptToText(segments),
  });
  return segments;
}
