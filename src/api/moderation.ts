import type { Podcast } from '../types';
import { requireBackend, supabase } from '../lib/supabase';

/* Modération : podcasts islamiques validés, podcasts masqués du catalogue, propositions des utilisateurs. */

export interface ValidatedRow {
  podcast_id: string;
  title: string;
  author: string;
  feed_url: string | null;
  note: string | null;
  created_at: string;
}

export interface SuggestionRow {
  id: number;
  podcast_id: string;
  title: string;
  author: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  suggested_by: string;
  created_at: string;
  profiles?: { username: string } | null;
}

export interface BlockedRow {
  podcast_id: string;
  title: string;
  created_at: string;
}

export function rowToPodcast(row: Pick<ValidatedRow, 'podcast_id' | 'title' | 'author' | 'feed_url'>): Podcast {
  return {
    id: row.podcast_id,
    title: row.title,
    author: row.author,
    artwork: '',
    feedUrl: row.feed_url ?? undefined,
    genre: 'Islam',
    native: row.podcast_id.startsWith('c-'),
  };
}

export async function getValidated(): Promise<ValidatedRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('islamic_podcasts').select('*').order('title').returns<ValidatedRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBlocked(): Promise<BlockedRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('blocked_podcasts').select('*').order('created_at', { ascending: false }).returns<BlockedRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function checkIsAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.rpc('is_admin');
  return data === true;
}

/** Rôles : administrateur > modérateur > utilisateur. */
export type Role = 'admin' | 'moderator' | 'user';

export async function getMyRole(): Promise<Role> {
  if (!supabase) return 'user';
  const { data, error } = await supabase.rpc('my_role');
  if (!error && (data === 'admin' || data === 'moderator' || data === 'user')) return data;
  // Base pas encore mise à jour (fonction my_role absente) : seuls les administrateurs sont connus.
  return (await checkIsAdmin()) ? 'admin' : 'user';
}

export async function validatePodcast(p: Podcast, note?: string): Promise<void> {
  const { error } = await requireBackend()
    .from('islamic_podcasts')
    .upsert({ podcast_id: p.id, title: p.title, author: p.author, feed_url: p.feedUrl ?? null, note: note ?? null });
  if (error) throw new Error(error.message);
}

export async function unvalidatePodcast(podcastId: string): Promise<void> {
  const { error } = await requireBackend().from('islamic_podcasts').delete().eq('podcast_id', podcastId);
  if (error) throw new Error(error.message);
}

export async function blockPodcast(p: Pick<Podcast, 'id' | 'title'>): Promise<void> {
  const { error } = await requireBackend().from('blocked_podcasts').upsert({ podcast_id: p.id, title: p.title });
  if (error) throw new Error(error.message);
}

export async function unblockPodcast(podcastId: string): Promise<void> {
  const { error } = await requireBackend().from('blocked_podcasts').delete().eq('podcast_id', podcastId);
  if (error) throw new Error(error.message);
}

export async function suggestPodcast(userId: string, p: Podcast, reason: string): Promise<void> {
  const { error } = await requireBackend()
    .from('podcast_suggestions')
    .insert({ podcast_id: p.id, title: p.title, author: p.author, reason: reason.trim() || null, suggested_by: userId });
  if (error) {
    if (error.code === '23505') throw new Error('Vous avez déjà proposé ce podcast.');
    throw new Error(error.message);
  }
}

export async function mySuggestions(userId: string): Promise<SuggestionRow[]> {
  const { data, error } = await requireBackend()
    .from('podcast_suggestions')
    .select('*')
    .eq('suggested_by', userId)
    .order('created_at', { ascending: false })
    .returns<SuggestionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function pendingSuggestions(): Promise<SuggestionRow[]> {
  const { data, error } = await requireBackend()
    .from('podcast_suggestions')
    .select('*, profiles(username)')
    .eq('status', 'pending')
    .order('created_at')
    .returns<SuggestionRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setSuggestionStatus(id: number, status: 'approved' | 'rejected'): Promise<void> {
  const { error } = await requireBackend().from('podcast_suggestions').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}
