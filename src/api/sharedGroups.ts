import { requireBackend, type Profile } from '../lib/supabase';
import { getLocalFileBlob, type FileGroup, type LocalFile } from '../lib/localFiles';
import type { Episode } from '../types';

/**
 * Groupes de « Mes fichiers » publiés sur le profil : visibles et écoutables par les amis mutuels
 * uniquement (vérifié par le serveur). Les fichiers sont dans un espace de stockage privé et lus
 * par des liens signés temporaires.
 */
const BUCKET = 'shared-files';
/** Limite de taille d'un fichier publié (offre gratuite de Supabase). */
export const MAX_SHARED_FILE_BYTES = 50 * 1024 * 1024;
/** Durée de validité des liens de lecture. */
const SIGNED_URL_SECONDS = 12 * 60 * 60;
export const SHARED_PREFIX = 'shared:';

export interface SharedItem {
  id: string;
  group_id: string;
  local_id: string;
  title: string;
  kind: 'audio' | 'video';
  storage_path: string;
  size: number;
  duration: number;
  position: number;
}

export interface SharedGroup {
  id: string;
  owner_id: string;
  name: string;
  hidden: boolean;
  created_at: string;
  updated_at: string;
  shared_group_items: SharedItem[];
  profiles?: Pick<Profile, 'username' | 'display_name'>;
}

function extensionOf(file: LocalFile): string {
  const fromMime = file.mime.split('/')[1]?.replace('mpeg', 'mp3').replace('quicktime', 'mov').replace('x-m4a', 'm4a').replace('x-', '');
  return (fromMime || (file.kind === 'video' ? 'mp4' : 'mp3')).slice(0, 8);
}

export interface PublishResult {
  remoteId: string;
  /** Fichiers non publiés (trop lourds ou refusés), avec la raison. */
  skipped: string[];
}

/**
 * Publie le groupe ou met sa publication à jour : envoie les fichiers manquants,
 * met à jour les titres et l'ordre, retire ceux qui ne sont plus dans le groupe.
 */
export async function publishGroup(
  userId: string,
  group: FileGroup,
  files: LocalFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<PublishResult> {
  const client = requireBackend();
  const name = group.name.trim().slice(0, 80) || 'Groupe';
  let remoteId = group.remoteId;
  if (remoteId) {
    const { data, error } = await client.from('shared_groups').update({ name, updated_at: new Date().toISOString() }).eq('id', remoteId).select('id');
    if (error) throw new Error(error.message);
    if (!data?.length) remoteId = undefined; // supprimé entre-temps (par la modération par exemple)
  }
  if (!remoteId) {
    const { data, error } = await client.from('shared_groups').insert({ owner_id: userId, name }).select('id').single<{ id: string }>();
    if (error) throw new Error(error.message.includes('row-level security') ? 'La publication est réservée à Podsal+.' : error.message);
    remoteId = data.id;
  }

  const { data: existing, error: listError } = await client.from('shared_group_items').select('*').eq('group_id', remoteId).returns<SharedItem[]>();
  if (listError) throw new Error(listError.message);
  const byLocal = new Map((existing ?? []).map((i) => [i.local_id, i]));
  const byId = new Map(files.map((f) => [f.id, f]));
  const wanted = group.fileIds.map((id) => byId.get(id)).filter((f): f is LocalFile => !!f);
  const skipped: string[] = [];
  let done = 0;
  onProgress?.(0, wanted.length);

  for (const [position, file] of wanted.entries()) {
    const current = byLocal.get(file.id);
    if (current) {
      if (current.title !== file.title || current.position !== position) {
        const { error } = await client.from('shared_group_items').update({ title: file.title.slice(0, 200), position }).eq('id', current.id);
        if (error) throw new Error(error.message);
      }
    } else if (file.size > MAX_SHARED_FILE_BYTES) {
      skipped.push(`« ${file.title} » dépasse 50 Mo : il reste privé.`);
    } else {
      const blob = await getLocalFileBlob(file.id);
      if (!blob) {
        skipped.push(`« ${file.title} » est introuvable sur cet appareil.`);
      } else {
        const path = `${userId}/${remoteId}/${file.id}.${extensionOf(file)}`;
        const upload = await client.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: file.mime });
        if (upload.error) {
          skipped.push(`« ${file.title} » n’a pas pu être envoyé (${upload.error.message}).`);
        } else {
          const { error } = await client.from('shared_group_items').insert({
            group_id: remoteId,
            local_id: file.id,
            title: file.title.slice(0, 200),
            kind: file.kind,
            storage_path: path,
            size: file.size,
            duration: file.duration,
            position,
          });
          if (error) throw new Error(error.message);
        }
      }
    }
    onProgress?.(++done, wanted.length);
  }

  // Fichiers retirés du groupe (ou supprimés de l'appareil) : retirés du serveur aussi.
  const keep = new Set(wanted.map((f) => f.id));
  const removed = (existing ?? []).filter((i) => !keep.has(i.local_id));
  if (removed.length) {
    await client.storage.from(BUCKET).remove(removed.map((i) => i.storage_path));
    const { error } = await client.from('shared_group_items').delete().in('id', removed.map((i) => i.id));
    if (error) throw new Error(error.message);
  }
  return { remoteId, skipped };
}

/** Retire la publication : supprime les fichiers du serveur et le groupe publié. */
export async function deleteSharedGroup(remoteId: string): Promise<void> {
  const client = requireBackend();
  const { data: items } = await client.from('shared_group_items').select('storage_path').eq('group_id', remoteId).returns<Pick<SharedItem, 'storage_path'>[]>();
  if (items?.length) await client.storage.from(BUCKET).remove(items.map((i) => i.storage_path));
  const { error } = await client.from('shared_groups').delete().eq('id', remoteId);
  if (error) throw new Error(error.message);
}

const GROUP_SELECT = '*, shared_group_items(*), profiles(username, display_name)';

function sortItems(groups: SharedGroup[]): SharedGroup[] {
  for (const g of groups) g.shared_group_items.sort((a, b) => a.position - b.position);
  return groups;
}

/** Groupes publiés d'un ami (vide si l'amitié n'est pas mutuelle : le serveur filtre). */
export async function getFriendGroups(ownerId: string): Promise<SharedGroup[]> {
  const { data, error } = await requireBackend()
    .from('shared_groups')
    .select(GROUP_SELECT)
    .eq('owner_id', ownerId)
    .eq('hidden', false)
    .order('updated_at', { ascending: false })
    .returns<SharedGroup[]>();
  if (error) throw new Error(error.message);
  return sortItems(data ?? []);
}

/** Modération : tous les groupes publiés (les administrateurs voient tout). */
export async function getAllSharedGroups(): Promise<SharedGroup[]> {
  const { data, error } = await requireBackend()
    .from('shared_groups')
    .select(GROUP_SELECT)
    .order('updated_at', { ascending: false })
    .limit(200)
    .returns<SharedGroup[]>();
  if (error) throw new Error(error.message);
  return sortItems(data ?? []);
}

export async function setSharedGroupHidden(remoteId: string, hidden: boolean): Promise<void> {
  const { error } = await requireBackend().from('shared_groups').update({ hidden }).eq('id', remoteId);
  if (error) throw new Error(error.message);
}

/** Épisodes jouables d'un groupe d'ami (liens de lecture valables 12 h). */
export async function sharedGroupEpisodes(group: SharedGroup, ownerUsername: string): Promise<Episode[]> {
  const items = group.shared_group_items;
  if (!items.length) return [];
  const { data, error } = await requireBackend()
    .storage.from(BUCKET)
    .createSignedUrls(
      items.map((i) => i.storage_path),
      SIGNED_URL_SECONDS,
    );
  if (error) throw new Error('Fichiers indisponibles pour le moment.');
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return items
    .filter((i) => urls.get(i.storage_path))
    .map((i) => ({
      id: `shared-${i.id}`,
      podcastId: `${SHARED_PREFIX}${ownerUsername}`,
      podcastTitle: group.name,
      title: i.title,
      description: '',
      audioUrl: urls.get(i.storage_path)!,
      duration: i.duration,
      releaseDate: group.updated_at,
      artwork: '',
      mediaKind: i.kind,
    }));
}
