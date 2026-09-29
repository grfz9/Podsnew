import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Heart, ListEnd, ListPlus, Pause, Play } from 'lucide-react';
import type { Episode } from '../types';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { formatDuration, formatReleaseDate, stripHtml } from '../utils/format';
import { progressRatio, remainingSeconds } from '../utils/progress';
import { Artwork } from './common';

interface Props {
  episode: Episode;
  /** Affiche la pochette et le nom du podcast (utile hors de la page du podcast). */
  showPodcast?: boolean;
}

export function EpisodeRow({ episode, showPodcast = false }: Props) {
  const player = usePlayer();
  const library = useLibrary();
  const [expanded, setExpanded] = useState(false);

  const progress = library.progress[episode.id];
  const ratio = progressRatio(progress, episode.duration);
  const isCurrent = player.current?.id === episode.id;
  const playingThis = isCurrent && player.isPlaying;
  const saved = library.isSaved(episode.id);
  const inQueue = player.queue.some((e) => e.id === episode.id);
  const description = stripHtml(episode.description);

  let timeLabel = formatDuration(episode.duration);
  if (progress?.completed) timeLabel = 'Écouté';
  else if (ratio > 0) timeLabel = `Reste ${formatDuration(remainingSeconds(progress, episode.duration))}`;

  return (
    <article className={`episode ${isCurrent ? 'episode--current' : ''} ${progress?.completed ? 'episode--done' : ''}`}>
      {showPodcast && (
        <Link to={`/podcast/${episode.podcastId}`} className="episode__art">
          <Artwork src={episode.artwork} alt={episode.podcastTitle} size={72} />
        </Link>
      )}
      <div className="episode__body">
        {showPodcast && (
          <Link to={`/podcast/${episode.podcastId}`} className="episode__podcast">
            {episode.podcastTitle}
          </Link>
        )}
        <h3 className="episode__title">{episode.title}</h3>
        {description && (
          <p
            className={`episode__desc ${expanded ? 'episode__desc--open' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Réduire' : 'Lire la suite'}
          >
            {description}
          </p>
        )}
        <div className="episode__actions">
          <button
            className="play-btn play-btn--small"
            onClick={() => (playingThis ? player.pause() : player.play(episode))}
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
          <button
            className="icon-btn"
            onClick={() => player.enqueueNext(episode)}
            aria-label="Lire ensuite"
            title="Lire ensuite"
            disabled={isCurrent}
          >
            <ListEnd size={18} />
          </button>
          <button
            className={`icon-btn ${inQueue ? 'icon-btn--active' : ''}`}
            onClick={() => (inQueue ? player.dequeue(episode.id) : player.enqueue(episode))}
            aria-label={inQueue ? 'Retirer de la file' : "Ajouter à la file d'attente"}
            title={inQueue ? 'Retirer de la file' : "Ajouter à la file d'attente"}
            disabled={isCurrent}
          >
            <ListPlus size={18} />
          </button>
          <button
            className={`icon-btn ${progress?.completed ? 'icon-btn--active' : ''}`}
            onClick={() => library.setCompleted(episode, !progress?.completed)}
            aria-label={progress?.completed ? 'Marquer comme non écouté' : 'Marquer comme écouté'}
            title={progress?.completed ? 'Marquer comme non écouté' : 'Marquer comme écouté'}
          >
            <Check size={18} />
          </button>
        </div>
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
