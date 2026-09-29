import type { Playlist } from '../types';
import { requireBackend, supabase, type Profile } from '../lib/supabase';

/**
 * Amis : une amitié existe quand deux personnes se sont ajoutées mutuellement.
 * Les amis peuvent seulement consulter et écouter les playlists l'un de l'autre :
 * aucun message, commentaire ni avis n'est possible.
 */

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

export interface Friendships {
  friends: Profile[];
  /** Demandes reçues (la personne m'a ajouté, pas encore réciproque). */
  incoming: Profile[];
  /** Demandes envoyées, en attente. */
  outgoing: Profile[];
}

export async function getFriendships(me: string): Promise<Friendships> {
  const client = requireBackend();
  const [out, inc] = await Promise.all([
    client.from('follows').select('profiles!follows_followee_id_fkey(*)').eq('follower_id', me).returns<{ profiles: Profile }[]>(),
    client.from('follows').select('profiles!follows_follower_id_fkey(*)').eq('followee_id', me).returns<{ profiles: Profile }[]>(),
  ]);
  if (out.error || inc.error) throw new Error((out.error ?? inc.error)!.message);
  const outgoing = (out.data ?? []).map((r) => r.profiles);
  const incoming = (inc.data ?? []).map((r) => r.profiles);
  const incomingIds = new Set(incoming.map((p) => p.id));
  const outgoingIds = new Set(outgoing.map((p) => p.id));
  return {
    friends: outgoing.filter((p) => incomingIds.has(p.id)),
    incoming: incoming.filter((p) => !outgoingIds.has(p.id)),
    outgoing: outgoing.filter((p) => !incomingIds.has(p.id)),
  };
}

/** Envoie une demande, ou accepte une demande reçue. */
export async function addFriend(me: string, target: string): Promise<void> {
  const { error } = await requireBackend().from('follows').insert({ follower_id: me, followee_id: target });
  if (error && error.code !== '23505') throw new Error(error.message);
}

/** Annule une demande, refuse une demande reçue ou retire un ami (dans les deux sens). */
export async function removeFriend(me: string, target: string): Promise<void> {
  const client = requireBackend();
  const [a, b] = await Promise.all([
    client.from('follows').delete().eq('follower_id', me).eq('followee_id', target),
    client.from('follows').delete().eq('follower_id', target).eq('followee_id', me),
  ]);
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
}

/** Playlists d'un ami (refusé par le serveur si l'amitié n'est pas mutuelle). */
export async function getFriendPlaylists(friendId: string): Promise<Playlist[]> {
  const { data, error } = await requireBackend().rpc('friend_playlists', { p_friend: friendId });
  if (error) throw new Error(error.message.includes('ami') ? error.message : 'Playlists indisponibles.');
  return (data ?? []) as Playlist[];
}
