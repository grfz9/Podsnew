import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronDown, ListMusic, Pencil, Play, Plus, Trash, X } from 'lucide-react';
import type { Episode, Playlist } from '../types';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { formatDuration } from '../utils/format';
import { episodePath, podcastPath } from '../lib/paths';
import { Artwork, EmptyState } from './common';

/* ---------- Fenêtre « Ajouter à une playlist » ---------- */

const PlaylistDialogContext = createContext<(episode: Episode) => void>(() => undefined);

export function usePlaylistDialog() {
  return useContext(PlaylistDialogContext);
}

export function PlaylistDialogProvider({ children }: { children: ReactNode }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const open = useCallback((e: Episode) => setEpisode(e), []);
  return (
    <PlaylistDialogContext.Provider value={open}>
      {children}
      {episode && <PlaylistDialog episode={episode} onClose={() => setEpisode(null)} />}
    </PlaylistDialogContext.Provider>
  );
}

function PlaylistDialog({ episode, onClose }: { episode: Episode; onClose: () => void }) {
  const library = useLibrary();
  const [name, setName] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.querySelector<HTMLElement>('button, input')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = (p: Playlist) => {
    library.addToPlaylist(p.id, episode);
    setDone(p.name);
    setTimeout(onClose, 700);
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const p = library.createPlaylist(name, [episode]);
    setDone(p.name);
    setTimeout(onClose, 700);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Ajouter à une playlist" ref={dialogRef}>
        <div className="dialog__head">
          <h2>Ajouter à une playlist</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <p className="small muted dialog__episode">{episode.title}</p>
        {done ? (
          <p className="ok-text">Ajouté à « {done} ».</p>
        ) : (
          <>
            <ul className="dialog__list">
              {library.playlists.map((p) => {
                const already = p.items.some((e) => e.id === episode.id);
                return (
                  <li key={p.id}>
                    <button className="dialog__item" onClick={() => add(p)} disabled={already}>
                      <ListMusic size={18} />
                      <span>{p.name}</span>
                      <span className="small muted">{already ? 'déjà ajouté' : `${p.items.length} élément${p.items.length > 1 ? 's' : ''}`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <form className="dialog__create" onSubmit={create}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle playlist" aria-label="Nom de la nouvelle playlist" maxLength={80} />
              <button className="btn btn--primary btn--small" type="submit" disabled={!name.trim()}>
                <Plus size={14} /> Créer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Affichage d'une playlist ---------- */

export function PlaylistView({ playlist, editable }: { playlist: Playlist; editable: boolean }) {
  const player = usePlayer();
  const library = useLibrary();
  const total = playlist.items.reduce((s, e) => s + (e.duration || 0), 0);

  if (!playlist.items.length) {
    return (
      <EmptyState icon={<ListMusic size={32} />} title="Playlist vide">
        {editable ? 'Ajoutez des épisodes ou des sourates avec « Ajouter à une playlist ».' : null}
      </EmptyState>
    );
  }
  return (
    <>
      <div className="row-actions playlist__actions">
        <button className="btn btn--primary" onClick={() => player.playAll(playlist.items)}>
          <Play size={16} fill="currentColor" /> Tout lire
        </button>
        <span className="small muted">
          {playlist.items.length} élément{playlist.items.length > 1 ? 's' : ''}
          {total > 0 && ` · ${formatDuration(total)}`}
        </span>
      </div>
      <ol className="queue">
        {playlist.items.map((ep, i) => (
          <li key={ep.id} className="queue-item">
            <Artwork alt={ep.podcastTitle} size={48} podcastId={ep.podcastId} genre={ep.genre} />
            <div className="queue-item__text">
              <Link to={episodePath(ep)} className="queue-item__title">
                {ep.title}
              </Link>
              <Link to={podcastPath(ep.podcastId)} className="small muted">
                {ep.podcastTitle}
              </Link>
            </div>
            <div className="queue-item__actions">
              <button className="icon-btn" onClick={() => player.play(ep)} aria-label={`Lire ${ep.title}`}>
                <Play size={18} />
              </button>
              {editable && (
                <>
                  <button className="icon-btn" onClick={() => library.movePlaylistItem(playlist.id, i, i - 1)} disabled={i === 0} aria-label="Monter">
                    <ChevronDown size={18} style={{ transform: 'rotate(180deg)' }} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => library.movePlaylistItem(playlist.id, i, i + 1)}
                    disabled={i === playlist.items.length - 1}
                    aria-label="Descendre"
                  >
                    <ChevronDown size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => library.removeFromPlaylist(playlist.id, ep.id)} aria-label="Retirer de la playlist">
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export function PlaylistPage() {
  const { id = '' } = useParams();
  const library = useLibrary();
  const navigate = useNavigate();
  const playlist = library.playlists.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist?.name ?? '');

  if (!playlist) {
    return (
      <div className="page">
        <EmptyState icon={<ListMusic size={32} />} title="Playlist introuvable" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__header">
        {editing ? (
          <form
            className="form form--inline"
            onSubmit={(e) => {
              e.preventDefault();
              library.renamePlaylist(playlist.id, name);
              setEditing(false);
            }}
          >
            <label>
              Nom
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </label>
            <button className="btn btn--primary btn--small" type="submit">
              Enregistrer
            </button>
          </form>
        ) : (
          <h1 className="page__title">{playlist.name}</h1>
        )}
        <div className="row-actions">
          <button className="btn btn--outline btn--small" onClick={() => setEditing((v) => !v)}>
            <Pencil size={14} /> Renommer
          </button>
          <button
            className="btn btn--danger btn--small"
            onClick={() => {
              if (!confirm(`Supprimer la playlist « ${playlist.name} » ?`)) return;
              library.deletePlaylist(playlist.id);
              navigate('/library?tab=playlists');
            }}
          >
            <Trash size={14} /> Supprimer
          </button>
        </div>
      </div>
      <p className="small muted">Vos amis peuvent voir et écouter vos playlists.</p>
      <PlaylistView playlist={playlist} editable />
    </div>
  );
}

/** Liste des playlists (bibliothèque ou profil d'un ami). */
export function PlaylistGrid({ playlists, linkTo }: { playlists: Playlist[]; linkTo?: (p: Playlist) => string }) {
  return (
    <div className="playlist-grid">
      {playlists.map((p) => {
        const content = (
          <>
            <span className="playlist-card__icon">
              <ListMusic size={28} />
            </span>
            <strong>{p.name}</strong>
            <span className="small muted">
              {p.items.length} élément{p.items.length > 1 ? 's' : ''}
            </span>
          </>
        );
        return linkTo ? (
          <Link key={p.id} to={linkTo(p)} className="playlist-card">
            {content}
          </Link>
        ) : (
          <div key={p.id} className="playlist-card">
            {content}
          </div>
        );
      })}
    </div>
  );
}
