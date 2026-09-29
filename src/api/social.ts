import type { Episode } from '../types';
import { requireBackend, supabase, type ActivityRow, type Profile, type ReviewRow } from '../lib/supabase';

/* ---------- Profils & abonnements entre utilisateurs ---------- */

export async function searchProfiles(query: string): Promise<Profile[]> {
  const q = query.trim().toLowerCase().replace(/[%_,()]/g, '');
  if (q.length < 2) return [];
  const { data, error } = await requireBackend()
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(20)
    .returns<Profile[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProfile(username: string): Promise<Profile | null> {
  const { data } = await requireBackend().from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle<Profile>();
  return data;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (!supabase) return false;
  const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('username', username.toLowerCase());
  return (count ?? 0) === 0;
}

export async function getFollowing(userId: string): Promise<Profile[]> {
  const { data, error } = await requireBackend()
    .from('follows')
    .select('profiles!follows_followee_id_fkey(*)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .returns<{ profiles: Profile }[]>();
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.profiles);
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const client = requireBackend();
  const [followers, following] = await Promise.all([
    client.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', userId),
    client.from('follows').select('followee_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function follow(me: string, target: string): Promise<void> {
  const { error } = await requireBackend().from('follows').insert({ follower_id: me, followee_id: target });
  if (error && error.code !== '23505') throw new Error(error.message);
}

export async function unfollow(me: string, target: string): Promise<void> {
  const { error } = await requireBackend().from('follows').delete().eq('follower_id', me).eq('followee_id', target);
  if (error) throw new Error(error.message);
}

/* ---------- Activité ---------- */

/** Version compacte d'un épisode pour l'activité (sans la longue description). */
export function episodeRef(e: Episode) {
  return { ...e, description: e.description.slice(0, 300) };
}

export interface ListenPayload {
  episode: Episode;
}
export interface ClipPayload {
  episode: Episode;
  start: number;
  end: number;
  note?: string;
}
export interface ReviewPayload {
  podcastId: string;
  podcastTitle: string;
  artwork: string;
  rating: number;
  body?: string;
}

export async function postActivity(userId: string, kind: 'listen', payload: ListenPayload): Promise<void>;
export async function postActivity(userId: string, kind: 'clip', payload: ClipPayload): Promise<void>;
export async function postActivity(userId: string, kind: 'review', payload: ReviewPayload): Promise<void>;
export async function postActivity(userId: string, kind: ActivityRow['kind'], payload: object): Promise<void> {
  const { error } = await requireBackend().from('activity').insert({ user_id: userId, kind, payload });
  if (error) throw new Error(error.message);
}

/** Activité des personnes suivies (la RLS ne renvoie que ce qu'on a le droit de voir). */
export async function getFeed(me: string, limit = 50): Promise<ActivityRow[]> {
  const { data, error } = await requireBackend()
    .from('activity')
    .select('*, profiles(username, display_name)')
    .neq('user_id', me)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<ActivityRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getUserActivity(userId: string, limit = 30): Promise<ActivityRow[]> {
  const { data, error } = await requireBackend()
    .from('activity')
    .select('*, profiles(username, display_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<ActivityRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ---------- Avis ---------- */

export async function getReviews(podcastId: string): Promise<ReviewRow[]> {
  const { data, error } = await requireBackend()
    .from('reviews')
    .select('*, profiles(username, display_name)')
    .eq('podcast_id', podcastId)
    .order('updated_at', { ascending: false })
    .limit(50)
    .returns<ReviewRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getRating(podcastId: string): Promise<{ average: number; count: number } | null> {
  const { data } = await requireBackend()
    .from('podcast_ratings')
    .select('average, count')
    .eq('podcast_id', podcastId)
    .maybeSingle<{ average: number; count: number }>();
  return data;
}

export async function saveReview(userId: string, podcastId: string, rating: number, body: string): Promise<void> {
  const { error } = await requireBackend()
    .from('reviews')
    .upsert(
      { podcast_id: podcastId, user_id: userId, rating, body: body.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'podcast_id,user_id' },
    );
  if (error) throw new Error(error.message);
}

export async function deleteReview(userId: string, podcastId: string): Promise<void> {
  const { error } = await requireBackend().from('reviews').delete().eq('podcast_id', podcastId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}
