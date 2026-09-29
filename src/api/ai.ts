import type { Episode, TranscriptSegment } from '../types';
import { callFunction, requireBackend, supabase, type EpisodeSummary } from '../lib/supabase';

export interface SummaryResult {
  summary: EpisodeSummary;
  source: 'transcript' | 'description';
}

/** Résumé déjà généré pour cet épisode (visible par tous), ou null. */
export async function getCachedSummary(episodeId: string): Promise<SummaryResult | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('episode_summaries').select('summary, source').eq('episode_id', episodeId).maybeSingle<SummaryResult>();
  return data;
}

export function requestSummary(podcastId: string, episodeId: string, country: string): Promise<SummaryResult> {
  return callFunction<SummaryResult>('summarize', { podcastId, episodeId, country });
}

/** Transcription récupérée et indexée par le serveur (utilisateur connecté). */
export async function getServerTranscript(podcastId: string, episodeId: string, country: string): Promise<TranscriptSegment[] | null> {
  const { segments } = await callFunction<{ segments: TranscriptSegment[] | null }>('transcript', { podcastId, episodeId, country });
  return segments;
}

export interface TranscriptHit {
  episode: Episode;
  /** Extrait avec les termes trouvés entre [[ et ]]. */
  snippet: string;
  startAt: number | null;
}

export async function searchTranscripts(query: string): Promise<TranscriptHit[]> {
  const { data, error } = await requireBackend().rpc('search_transcripts', { q: query, max_results: 20 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { episode: Episode; snippet: string; start_at: number | null }[]).map((r) => ({
    episode: r.episode,
    snippet: r.snippet,
    startAt: r.start_at,
  }));
}
