import { Link } from 'react-router';
import { Headphones, Play, Scissors, Star } from 'lucide-react';
import type { ActivityRow } from '../lib/supabase';
import type { ClipPayload, ListenPayload, ReviewPayload } from '../api/social';
import { usePlayer } from '../store/player';
import { formatReleaseDate, formatTime } from '../utils/format';
import { Artwork, Stars } from './common';
import { episodePath } from './EpisodeRow';
import { clipPath } from './EpisodeExtras';

function Author({ row }: { row: ActivityRow }) {
  const name = row.profiles?.display_name || row.profiles?.username || 'Quelqu’un';
  return row.profiles?.username ? (
    <Link to={`/u/${row.profiles.username}`} className="activity__author">
      {name}
    </Link>
  ) : (
    <strong>{name}</strong>
  );
}

export function ActivityItem({ row, showAuthor = true }: { row: ActivityRow; showAuthor?: boolean }) {
  const player = usePlayer();

  if (row.kind === 'review') {
    const p = row.payload as unknown as ReviewPayload;
    return (
      <article className="activity">
        <Link to={`/podcast/${p.podcastId}`}>
          <Artwork src={p.artwork} alt={p.podcastTitle} size={56} />
        </Link>
        <div className="activity__body">
          <p className="small">
            <Star size={14} /> {showAuthor && <Author row={row} />} {showAuthor ? 'a noté' : 'Note pour'}{' '}
            <Link to={`/podcast/${p.podcastId}`} className="link">
              {p.podcastTitle}
            </Link>
          </p>
          <Stars value={p.rating} size={14} />
          {p.body && <p className="activity__quote">{p.body}</p>}
          <span className="small muted">{formatReleaseDate(row.created_at)}</span>
        </div>
      </article>
    );
  }

  const p = row.payload as unknown as ListenPayload | ClipPayload;
  const episode = p.episode;
  const isClip = row.kind === 'clip';
  const clip = p as ClipPayload;
  return (
    <article className="activity">
      <Link to={episodePath(episode)}>
        <Artwork src={episode.artwork} alt={episode.podcastTitle} size={56} />
      </Link>
      <div className="activity__body">
        <p className="small">
          {isClip ? <Scissors size={14} /> : <Headphones size={14} />} {showAuthor && <Author row={row} />}{' '}
          {isClip ? `a partagé un extrait (${formatTime(clip.start)} – ${formatTime(clip.end)})` : 'a écouté'}
        </p>
        <Link to={isClip ? clipPath(episode, clip.start, clip.end, clip.note) : episodePath(episode)} className="activity__title">
          {episode.title}
        </Link>
        <span className="small muted">
          {episode.podcastTitle} · {formatReleaseDate(row.created_at)}
        </span>
        {isClip && clip.note && <p className="activity__quote">{clip.note}</p>}
      </div>
      <button
        className="play-btn play-btn--small"
        aria-label={isClip ? "Écouter l'extrait" : "Écouter l'épisode"}
        onClick={() => (isClip ? player.playSegment(episode, clip.start, clip.end) : player.play(episode))}
      >
        <Play size={16} fill="currentColor" />
      </button>
    </article>
  );
}
