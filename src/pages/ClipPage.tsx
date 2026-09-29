import { Link, useSearchParams } from 'react-router';
import { Play, Scissors } from 'lucide-react';
import { Artwork, EmptyState, ErrorState, Spinner } from '../components/common';
import { episodePath } from '../components/EpisodeRow';
import { CLIP_MAX } from '../components/EpisodeExtras';
import { useEpisode } from '../lib/useEpisode';
import { usePlayer, usePlayerTime } from '../store/player';
import { formatTime } from '../utils/format';

/** Page d'un extrait partagé : lit uniquement le passage choisi. */
export function ClipPage() {
  const [params] = useSearchParams();
  const podcastId = params.get('p') ?? '';
  const episodeId = params.get('e') ?? '';
  const start = Math.max(0, Number(params.get('s')) || 0);
  const end = Math.min(start + CLIP_MAX, Number(params.get('t')) || start + 30);
  const note = params.get('n')?.slice(0, 140);
  const { data, error, loading, reload } = useEpisode(podcastId, episodeId);
  const player = usePlayer();
  const { time } = usePlayerTime();

  if (!podcastId || !episodeId) {
    return (
      <div className="page">
        <EmptyState icon={<Scissors size={32} />} title="Lien d'extrait incomplet" />
      </div>
    );
  }
  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (!data) return <div className="page">{error && <ErrorState error={error} onRetry={reload} />}</div>;

  const { episode } = data;
  const active = player.current?.id === episode.id && player.segment !== null;
  const elapsed = active ? Math.min(end - start, Math.max(0, time - start)) : 0;

  return (
    <div className="page clip-page">
      <Artwork src={episode.artwork} alt={episode.podcastTitle} className="clip-page__art" />
      <p className="small muted">
        Extrait · {formatTime(start)} – {formatTime(end)}
      </p>
      <h1>{episode.title}</h1>
      <Link to={`/podcast/${episode.podcastId}`} className="muted">
        {episode.podcastTitle}
      </Link>
      {note && <blockquote className="clip-page__note">{note}</blockquote>}
      <div className="clip-page__bar" aria-hidden>
        <span style={{ width: `${(elapsed / (end - start)) * 100}%` }} />
      </div>
      <div className="row-actions">
        <button className="btn btn--primary" onClick={() => player.playSegment(episode, start, end)}>
          <Play size={16} fill="currentColor" /> Écouter l'extrait ({formatTime(end - start)})
        </button>
        <Link to={episodePath(episode)} className="btn btn--outline">
          Épisode complet
        </Link>
      </div>
    </div>
  );
}
