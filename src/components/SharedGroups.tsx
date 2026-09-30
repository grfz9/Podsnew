import { useState } from 'react';
import { Film, Folder, Music, Pause, Play } from 'lucide-react';
import { deleteSharedGroup, getAllSharedGroups, getFriendGroups, setSharedGroupHidden, sharedGroupEpisodes, type SharedGroup } from '../api/sharedGroups';
import { usePlayer } from '../store/player';
import type { Episode } from '../types';
import { formatDuration } from '../utils/format';
import { useAsync } from '../utils/hooks';
import { ErrorState, NowPlaying, Spinner } from './common';
import { expandPlayerFor } from './playLocal';

/** Groupes de fichiers publiés par un ami, sur son profil (le serveur vérifie l'amitié mutuelle). */
export function FriendGroups({ ownerId, username, name }: { ownerId: string; username: string; name: string }) {
  const groups = useAsync(() => getFriendGroups(ownerId), [ownerId]);
  if (groups.loading && !groups.data) return <Spinner />;
  if (groups.error) return <ErrorState error={groups.error} onRetry={groups.reload} />;
  if (!groups.data?.length) return null;
  return (
    <section className="shared-groups">
      <h2 className="section-title">Groupes de {name}</h2>
      {groups.data.map((g) => (
        <SharedGroupView key={g.id} group={g} username={username} />
      ))}
    </section>
  );
}

function SharedGroupView({ group, username }: { group: SharedGroup; username: string }) {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = group.shared_group_items;
  const duration = items.reduce((sum, i) => sum + i.duration, 0);

  // Les liens de lecture (temporaires) sont créés à l'ouverture du groupe.
  const load = async (): Promise<Episode[]> => {
    if (episodes) return episodes;
    try {
      const list = await sharedGroupEpisodes(group, username);
      setEpisodes(list);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  };

  const playAt = async (index: number) => {
    const list = await load();
    const episode = list[index];
    if (!episode) return;
    if (player.current?.id === episode.id) return player.toggle();
    player.playAll(list.slice(index));
    expandPlayerFor(episode);
  };

  return (
    <div className="shared-group">
      <div className="file-group">
        <button className="play-btn" onClick={() => playAt(0)} disabled={!items.length} aria-label={`Lire le groupe ${group.name}`}>
          <Play size={18} fill="currentColor" />
        </button>
        <button
          className="file-group__body"
          onClick={() => {
            setOpen((v) => !v);
            void load();
          }}
          aria-expanded={open}
        >
          <span className="file-group__name">
            <Folder size={16} /> {group.name}
          </span>
          <span className="local-file__meta">
            {items.length} fichier{items.length > 1 ? 's' : ''}
            {duration > 0 && ` · ${formatDuration(duration)}`}
          </span>
        </button>
      </div>
      {error && <p className="small error-text">{error}</p>}
      {open && (
        <ol className="local-files__list shared-group__items">
          {items.map((item, i) => {
            const isCurrent = player.current?.id === `shared-${item.id}`;
            const playing = isCurrent && player.isPlaying;
            const Icon = item.kind === 'video' ? Film : Music;
            return (
              <li key={item.id} className={`local-file ${isCurrent ? 'local-file--current' : ''}`}>
                <button className="play-btn" onClick={() => playAt(i)} aria-label={playing ? 'Pause' : `Lire ${item.title}`}>
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <div className="local-file__body">
                  <button className="local-file__title" onClick={() => playAt(i)}>
                    {isCurrent && <NowPlaying paused={!player.isPlaying} />} {i + 1}. {item.title}
                  </button>
                  <span className="local-file__meta">
                    <Icon size={12} /> {item.kind === 'video' ? 'Vidéo' : 'Audio'}
                    {item.duration > 0 && ` · ${formatDuration(item.duration)}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Modération : tous les groupes publiés, avec écoute, masquage et suppression. */
export function ModerationGroups() {
  const groups = useAsync(() => getAllSharedGroups(), []);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      groups.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (groups.loading && !groups.data) return <Spinner />;
  if (groups.error) return <ErrorState error={groups.error} onRetry={groups.reload} />;
  if (!groups.data?.length) return <p className="muted">Aucun groupe publié pour le moment.</p>;
  return (
    <section className="shared-groups">
      <p className="small muted">
        Groupes de fichiers publiés par les membres pour leurs amis. Masquer un groupe le cache aux amis (le propriétaire le voit encore) ;
        supprimer retire aussi ses fichiers du serveur.
      </p>
      {error && <p className="small error-text">{error}</p>}
      {groups.data.map((g) => {
        const username = g.profiles?.username ?? '';
        return (
          <div key={g.id} className={`moderation-group ${g.hidden ? 'moderation-group--hidden' : ''}`}>
            <p className="small">
              <strong>@{username || 'inconnu'}</strong> · {g.hidden ? 'masqué' : 'visible par ses amis'} · mis à jour le{' '}
              {new Date(g.updated_at).toLocaleDateString('fr-FR')}
            </p>
            <SharedGroupView group={g} username={username} />
            <span className="row-actions">
              <button className="btn btn--outline btn--small" onClick={() => run(() => setSharedGroupHidden(g.id, !g.hidden))}>
                {g.hidden ? 'Rétablir' : 'Masquer'}
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={() => window.confirm(`Supprimer le groupe « ${g.name} » de @${username} et ses fichiers ?`) && run(() => deleteSharedGroup(g.id))}
              >
                Supprimer
              </button>
            </span>
          </div>
        );
      })}
    </section>
  );
}
