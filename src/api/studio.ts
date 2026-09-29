import { requireBackend, type CreatorEpisodeRow, type CreatorPodcastRow } from '../lib/supabase';

/* Espace créateurs : publier son podcast et suivre ses écoutes. */

export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav'];

export type PodcastInput = Pick<CreatorPodcastRow, 'title' | 'description' | 'author' | 'category_id' | 'language' | 'explicit'> & {
  cover_url?: string | null;
  contact_email?: string | null;
};

export async function myPodcasts(ownerId: string): Promise<CreatorPodcastRow[]> {
  const { data, error } = await requireBackend()
    .from('creator_podcasts')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .returns<CreatorPodcastRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getMyPodcast(id: string): Promise<CreatorPodcastRow & { contact_email: string | null }> {
  const { data, error } = await requireBackend().from('creator_podcasts').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createPodcast(ownerId: string, input: PodcastInput): Promise<CreatorPodcastRow> {
  const { data, error } = await requireBackend()
    .from('creator_podcasts')
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single<CreatorPodcastRow>();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePodcast(id: string, input: Partial<PodcastInput>): Promise<void> {
  const { error } = await requireBackend()
    .from('creator_podcasts')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePodcast(id: string): Promise<void> {
  const client = requireBackend();
  const episodes = await listEpisodes(id);
  if (episodes.length) await client.storage.from('episodes').remove(episodes.map((e) => e.audio_path));
  const { error } = await client.from('creator_podcasts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listEpisodes(podcastId: string): Promise<CreatorEpisodeRow[]> {
  const { data, error } = await requireBackend()
    .from('creator_episodes')
    .select('*')
    .eq('podcast_id', podcastId)
    .order('published_at', { ascending: false })
    .returns<CreatorEpisodeRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

function extension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  return fromName && /^[a-z0-9]{2,4}$/.test(fromName) ? fromName : 'bin';
}

export async function uploadCover(ownerId: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Format accepté : JPEG, PNG ou WebP.');
  if (file.size > MAX_COVER_BYTES) throw new Error('La pochette doit peser moins de 2 Mo.');
  const client = requireBackend();
  const path = `${ownerId}/${crypto.randomUUID()}.${extension(file)}`;
  const { error } = await client.storage.from('covers').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return client.storage.from('covers').getPublicUrl(path).data.publicUrl;
}

/** Durée d'un fichier audio local, lue par le navigateur. */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const done = (value: number) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0);
    audio.onerror = () => done(0);
    audio.src = url;
  });
}

/** Envoi avec suivi de progression (XHR : l'API fetch ne donne pas l'avancement de l'envoi). */
function uploadWithProgress(bucket: string, path: string, file: File, token: string, onProgress: (ratio: number) => void): Promise<void> {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${base}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', key);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Envoi refusé (${xhr.status}).`;
      try {
        message = JSON.parse(xhr.responseText).message ?? message;
      } catch {
        /* réponse non JSON */
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Échec de l'envoi : vérifiez votre connexion."));
    xhr.send(file);
  });
}

export interface EpisodeInput {
  title: string;
  description: string;
  published_at?: string;
}

export async function publishEpisode(
  ownerId: string,
  podcastId: string,
  file: File,
  input: EpisodeInput,
  onProgress: (ratio: number) => void,
): Promise<CreatorEpisodeRow> {
  if (!AUDIO_TYPES.includes(file.type)) throw new Error('Format audio accepté : MP3, M4A, AAC, OGG ou WAV.');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Le fichier audio doit peser moins de 200 Mo.');
  const client = requireBackend();
  const { data: session } = await client.auth.getSession();
  if (!session.session) throw new Error('Connexion requise.');
  const duration = await readAudioDuration(file);
  const path = `${ownerId}/${podcastId}/${crypto.randomUUID()}.${extension(file)}`;
  await uploadWithProgress('episodes', path, file, session.session.access_token, onProgress);
  const audio_url = client.storage.from('episodes').getPublicUrl(path).data.publicUrl;
  const { data, error } = await client
    .from('creator_episodes')
    .insert({
      podcast_id: podcastId,
      title: input.title,
      description: input.description,
      published_at: input.published_at ?? new Date().toISOString(),
      audio_url,
      audio_path: path,
      audio_size: file.size,
      audio_type: file.type,
      duration,
    })
    .select()
    .single<CreatorEpisodeRow>();
  if (error) {
    await client.storage.from('episodes').remove([path]);
    throw new Error(error.message);
  }
  return data;
}

export async function updateEpisode(id: string, input: Partial<EpisodeInput>): Promise<void> {
  const { error } = await requireBackend().from('creator_episodes').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteEpisode(episode: CreatorEpisodeRow): Promise<void> {
  const client = requireBackend();
  const { error } = await client.from('creator_episodes').delete().eq('id', episode.id);
  if (error) throw new Error(error.message);
  await client.storage.from('episodes').remove([episode.audio_path]);
}

export interface CreatorStats {
  episodes: { id: string; title: string; published_at: string; duration: number; plays: number; listeners: number; avg_seconds: number }[];
  daily: { day: string; plays: number }[];
}

export async function getCreatorStats(podcastId: string): Promise<CreatorStats> {
  const { data, error } = await requireBackend().rpc('creator_stats', { p_podcast: podcastId });
  if (error) throw new Error(error.message);
  return data as CreatorStats;
}
