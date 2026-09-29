import type { Chapter, Episode, Podcast, TranscriptSegment } from '../types';
import {
  findItem,
  parseChaptersJson,
  parseFeed,
  parseTranscript,
  pickTranscript,
  type FeedItem,
  type ParsedFeed,
  type TranscriptRef,
} from '../../supabase/functions/_shared/podcast';
import { idbGet, idbGetAll, idbPut } from './idb';
import { callFunction, supabase } from './supabase';

/**
 * Récupère un fichier distant (flux RSS, chapitres, transcription).
 * Beaucoup d'hébergeurs refusent les requêtes cross-origin : on passe alors
 * par la fonction serveur « proxy » (si les comptes sont activés et l'utilisateur connecté).
 */
export async function fetchRemoteText(url: string, signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    return await res.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    if (!session) throw new Error('Le serveur du podcast ne permet pas la lecture de ce fichier depuis le navigateur.');
    const { body } = await callFunction<{ body: string }>('proxy', { url });
    return body;
  }
}

const feeds = new Map<string, Promise<ParsedFeed>>();

export function getFeed(feedUrl: string): Promise<ParsedFeed> {
  let hit = feeds.get(feedUrl);
  if (!hit) {
    hit = fetchRemoteText(feedUrl).then(parseFeed);
    hit.catch(() => feeds.delete(feedUrl));
    feeds.set(feedUrl, hit);
  }
  return hit;
}

export interface EpisodeExtras {
  item?: FeedItem;
  chapters: Chapter[];
  transcript?: TranscriptRef;
}

/** Chapitres et transcription d'un épisode, d'après le flux RSS du podcast. */
export async function getEpisodeExtras(podcast: Pick<Podcast, 'feedUrl'>, episode: Episode): Promise<EpisodeExtras> {
  if (!podcast.feedUrl) return { chapters: [] };
  const feed = await getFeed(podcast.feedUrl);
  const item = findItem(feed, episode);
  if (!item) return { chapters: [] };
  let chapters: Chapter[] = item.inlineChapters ?? [];
  if (!chapters.length && item.chaptersUrl) {
    try {
      chapters = parseChaptersJson(JSON.parse(await fetchRemoteText(item.chaptersUrl)));
    } catch {
      chapters = [];
    }
  }
  return { item, chapters, transcript: pickTranscript(item.transcripts, 'fr') };
}

interface StoredTranscript {
  episodeId: string;
  episode: Episode;
  segments: TranscriptSegment[];
  source: string;
  savedAt: number;
}

export async function getTranscript(episode: Episode, ref: TranscriptRef): Promise<TranscriptSegment[]> {
  const stored = await idbGet<StoredTranscript>('transcripts', episode.id).catch(() => undefined);
  if (stored?.source === ref.url) return stored.segments;
  const segments = parseTranscript(await fetchRemoteText(ref.url), ref.type);
  if (segments.length) {
    idbPut('transcripts', { episodeId: episode.id, episode, segments, source: ref.url, savedAt: Date.now() } satisfies StoredTranscript).catch(
      () => undefined,
    );
  }
  return segments;
}

export interface LocalTranscriptHit {
  episode: Episode;
  start: number;
  text: string;
}

/** Recherche dans les transcriptions déjà consultées sur cet appareil. */
export async function searchLocalTranscripts(query: string): Promise<LocalTranscriptHit[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const all = await idbGetAll<StoredTranscript>('transcripts').catch(() => []);
  const hits: LocalTranscriptHit[] = [];
  for (const t of all) {
    const seg = t.segments.find((s) => s.text.toLowerCase().includes(needle));
    if (seg) hits.push({ episode: t.episode, start: Math.max(0, seg.start), text: seg.text });
  }
  return hits;
}
