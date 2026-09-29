import type { Episode, Podcast } from '../types';
import { getGenre } from './genres';
import { supabase, type CreatorEpisodeRow, type CreatorPodcastRow } from '../lib/supabase';

/**
 * Podcasts publiés directement sur Podsnew par des créateurs (espace Studio).
 * Leurs identifiants sont préfixés par « c- » pour les distinguer du catalogue Apple.
 */
export const NATIVE_PREFIX = 'c-';

export const isNativeId = (id: string) => id.startsWith(NATIVE_PREFIX);
export const toNativeId = (uuid: string) => `${NATIVE_PREFIX}${uuid}`;
export const fromNativeId = (id: string) => id.slice(NATIVE_PREFIX.length);

export function rssUrl(podcastUuid: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return base ? `${base.replace(/\/$/, '')}/functions/v1/rss?podcast=${podcastUuid}` : '';
}

export function rowToPodcast(row: CreatorPodcastRow, episodeCount?: number): Podcast {
  return {
    id: toNativeId(row.id),
    title: row.title,
    author: row.author,
    artwork: row.cover_url ?? '',
    genre: getGenre(row.category_id)?.name,
    genreIds: [String(row.category_id)],
    description: row.description,
    feedUrl: rssUrl(row.id),
    episodeCount,
    native: true,
  };
}

export function rowToEpisode(row: CreatorEpisodeRow, podcast: Podcast): Episode {
  return {
    id: toNativeId(row.id),
    podcastId: podcast.id,
    podcastTitle: podcast.title,
    title: row.title,
    description: row.description,
    audioUrl: row.audio_url,
    duration: row.duration,
    releaseDate: row.published_at,
    artwork: podcast.artwork,
    guid: row.id,
    genre: podcast.genre,
  };
}

export async function getNativePodcast(id: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
  if (!supabase) throw new Error('Podcast introuvable');
  const uuid = fromNativeId(id);
  const [{ data: row, error }, { data: rows, error: epError }] = await Promise.all([
    supabase.from('creator_podcasts').select('*').eq('id', uuid).maybeSingle<CreatorPodcastRow>(),
    supabase
      .from('creator_episodes')
      .select('*')
      .eq('podcast_id', uuid)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .returns<CreatorEpisodeRow[]>(),
  ]);
  if (error || epError) throw new Error((error ?? epError)!.message);
  if (!row) throw new Error('Podcast introuvable');
  const podcast = rowToPodcast(row, rows?.length ?? 0);
  return { podcast, episodes: (rows ?? []).map((r) => rowToEpisode(r, podcast)) };
}

export async function searchNativePodcasts(term: string): Promise<Podcast[]> {
  if (!supabase) return [];
  const pattern = `%${term.replace(/[%_,()]/g, ' ').trim()}%`;
  const { data } = await supabase
    .from('creator_podcasts')
    .select('*, creator_episodes!inner(id)')
    .or(`title.ilike.${pattern},author.ilike.${pattern}`)
    .limit(20)
    .returns<CreatorPodcastRow[]>();
  return (data ?? []).map((r) => rowToPodcast(r));
}

/** Podcasts de créateurs récemment mis à jour (avec au moins un épisode). */
export async function latestNativePodcasts(limit = 12): Promise<Podcast[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('creator_podcasts')
    .select('*, creator_episodes!inner(id)')
    .order('updated_at', { ascending: false })
    .limit(limit)
    .returns<CreatorPodcastRow[]>();
  return (data ?? []).map((r) => rowToPodcast(r));
}

/** Compte une écoute pour les statistiques du créateur (au-delà de 30 s). */
export async function trackNativePlay(episodeId: string, sessionId: string, seconds: number): Promise<void> {
  if (!supabase || !isNativeId(episodeId)) return;
  await supabase.rpc('track_play', { p_episode: fromNativeId(episodeId), p_session: sessionId, p_seconds: Math.round(seconds) });
}
