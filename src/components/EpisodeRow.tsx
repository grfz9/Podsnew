import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, CircleCheck, Download, Heart, ListEnd, ListMusic, ListPlus, LoaderCircle, Ellipsis, Pause, Play, Scissors, Share2, Trash, X } from 'lucide-react';
import type { Episode } from '../types';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { useDownloads } from '../store/downloads';
import { formatDuration, formatReleaseDate, stripHtml } from '../utils/format';
import { progressRatio, remainingSeconds } from '../utils/progress';
import { Artwork, Menu, shareLink, type MenuItem } from './common';
import { usePlaylistDialog } from './Playlists';
import { absoluteUrl, episodePath, podcastPath } from '../lib/paths';

export { episodePath };

export function episodeUrl(e: Pick<Episode, 'podcastId' | 'id'>): string {
  return absoluteUrl(episodePath(e));
}

/** Bouton de téléchargement pour l'écoute hors-ligne (avec progression). */
export function DownloadButton({ episode }: { episode: Episode }) {
  const downloads = useDownloads();
  const status = downloads.status(episode.id);
  if (status.state === 'downloading') {
    return (
      <button
        className="icon-btn download-progress"
        onClick={() => downloads.cancel(episode.id)}
        aria-label={`Téléchargement ${Math.round(status.progress * 100)} %, annuler`}
        title="Annuler le téléchargement"
        style={{ '--p': `${status.progress * 360}deg` } as CSSProperties}
      >
        {status.progress > 0 ? <X size={14} /> : <LoaderCircle className="spin" size={18} />}
      </button>
    );
  }
  if (status.state === 'done') {
    return (
      <button className="icon-btn icon-btn--active" onClick={() => downloads.remove(episode.id)} aria-label="Supprimer le téléchargement" title="Téléchargé — cliquer pour supprimer">
        <CircleCheck size={18} />
      </button>
    );
  }
  return (
    <button
      className="icon-btn"
      onClick={() => downloads.download(episode)}
      aria-label="Télécharger pour écouter hors-ligne"
      title={status.state === 'error' ? status.message : 'Télécharger'}
    >
      <Download size={18} />
    </button>
  );
}

interface Props {
  episode: Episode;
  /** Affiche la pochette et le nom du podcast (utile hors de la page du podcast). */
  showPodcast?: boolean;
  /** Texte affiché à la place de la description (ex. extrait de transcription). */
  excerpt?: ReactNode;
  /** Position de départ (ex. moment trouvé dans une transcription). */
  startAt?: number;
}

export function EpisodeRow({ episode, showPodcast = false, excerpt, startAt }: Props) {
  const player = usePlayer();
  const library = useLibrary();
  const downloads = useDownloads();
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const openPlaylist = usePlaylistDialog();

  const progress = library.progress[episode.id];
  const ratio = progressRatio(progress, episode.duration);
  const isCurrent = player.current?.id === episode.id;
  const playingThis = isCurrent && player.isPlaying;
  const saved = library.isSaved(episode.id);
  const inQueue = player.queue.some((e) => e.id === episode.id);
  const description = stripHtml(episode.description);
  const downloadError = downloads.status(episode.id);

  let timeLabel = formatDuration(episode.duration);
  if (progress?.completed) timeLabel = 'Écouté';
  else if (ratio > 0) timeLabel = `Reste ${formatDuration(remainingSeconds(progress, episode.duration))}`;

  const menu: MenuItem[] = [
    { label: 'Lire ensuite', icon: <ListEnd size={16} />, onSelect: () => player.enqueueNext(episode), disabled: isCurrent },
    inQueue
      ? { label: 'Retirer de la file', icon: <Trash size={16} />, onSelect: () => player.dequeue(episode.id) }
      : { label: "Ajouter à la file d'attente", icon: <ListPlus size={16} />, onSelect: () => player.enqueue(episode), disabled: isCurrent },
    {
      label: progress?.completed ? 'Marquer comme non écouté' : 'Marquer comme écouté',
      icon: <Check size={16} />,
      onSelect: () => library.setCompleted(episode, !progress?.completed),
    },
    { label: 'Ajouter à une playlist', icon: <ListMusic size={16} />, onSelect: () => openPlaylist(episode) },
    { label: 'Créer un extrait', icon: <Scissors size={16} />, onSelect: () => navigate(`${episodePath(episode)}?clip=1`) },
    {
      label: 'Partager',
      icon: <Share2 size={16} />,
      onSelect: () => shareLink(episode.title, episodeUrl(episode)).then((m) => m && setNotice(m)),
    },
  ];

  return (
    <article className={`episode ${isCurrent ? 'episode--current' : ''} ${progress?.completed ? 'episode--done' : ''}`}>
      {showPodcast && (
        <Link to={podcastPath(episode.podcastId)} className="episode__art" tabIndex={-1}>
          <Artwork alt={episode.podcastTitle} size={72} kind={episode.podcastId.startsWith('quran-') ? 'quran' : 'podcast'} />
        </Link>
      )}
      <div className="episode__body">
        {showPodcast && (
          <Link to={podcastPath(episode.podcastId)} className="episode__podcast">
            {episode.podcastTitle}
          </Link>
        )}
        <h3 className="episode__title">
          <Link to={episodePath(episode)}>{episode.title}</Link>
        </h3>
        {excerpt ? (
          <p className="episode__desc episode__desc--open">{excerpt}</p>
        ) : (
          description && (
            <p
              className={`episode__desc ${expanded ? 'episode__desc--open' : ''}`}
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? 'Réduire' : 'Lire la suite'}
            >
              {description}
            </p>
          )
        )}
        <div className="episode__actions">
          <button
            className="play-btn play-btn--small"
            onClick={() => (playingThis ? player.pause() : player.play(episode, startAt))}
            aria-label={playingThis ? 'Pause' : 'Lire'}
          >
            {playingThis ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <span className="episode__meta">
            {formatReleaseDate(episode.releaseDate)}
            {timeLabel && <> · {timeLabel}</>}
          </span>
          {ratio > 0 && ratio < 1 && (
            <span className="mini-progress" aria-hidden>
              <span style={{ width: `${ratio * 100}%` }} />
            </span>
          )}
          <span className="spacer" />
          <button
            className={`icon-btn ${saved ? 'icon-btn--active' : ''}`}
            onClick={() => library.toggleSaved(episode)}
            aria-label={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            title={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          >
            <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <DownloadButton episode={episode} />
          <Menu trigger={<Ellipsis size={18} />} label="Plus d'actions" items={menu} />
        </div>
        {notice && <p className="small muted">{notice}</p>}
        {downloadError.state === 'error' && <p className="small error-text">{downloadError.message}</p>}
      </div>
    </article>
  );
}

export function EpisodeList({ episodes, showPodcast }: { episodes: Episode[]; showPodcast?: boolean }) {
  return (
    <div className="episode-list">
      {episodes.map((e) => (
        <EpisodeRow key={e.id} episode={e} showPodcast={showPodcast} />
      ))}
    </div>
  );
}
