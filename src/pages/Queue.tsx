import { Link } from 'react-router';
import { ChevronDown, ListMusic, Play, Trash, X } from 'lucide-react';
import { Artwork, EmptyState } from '../components/common';
import { usePlayer } from '../store/player';
import { formatDuration } from '../utils/format';
import { podcastPath } from '../lib/paths';

export function QueuePage() {
  const player = usePlayer();
  const { current, queue } = player;

  return (
    <div className="page">
      <h1 className="page__title">File d'attente</h1>

      {current && (
        <>
          <h2 className="section-title">En cours de lecture</h2>
          <div className="queue-item queue-item--current">
            <Artwork alt={current.podcastTitle} size={56} podcastId={current.podcastId} genre={current.genre} />
            <div className="queue-item__text">
              <div className="queue-item__title">{current.title}</div>
              <Link to={podcastPath(current.podcastId)} className="small muted">
                {current.podcastTitle}
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="section__header">
        <h2 className="section-title">À suivre</h2>
        {queue.length > 0 && (
          <button className="btn btn--outline btn--small" onClick={player.clearQueue}>
            <Trash size={14} /> Tout effacer
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <EmptyState icon={<ListMusic size={32} />} title="Votre file d'attente est vide">
          Ajoutez des épisodes avec le bouton <strong>+</strong> pour les enchaîner automatiquement.
        </EmptyState>
      ) : (
        <ol className="queue">
          {queue.map((ep, i) => (
            <li key={ep.id} className="queue-item">
              <Artwork alt={ep.podcastTitle} size={48} podcastId={ep.podcastId} genre={ep.genre} />
              <div className="queue-item__text">
                <div className="queue-item__title">{ep.title}</div>
                <div className="small muted">
                  {ep.podcastTitle}
                  {ep.duration ? ` · ${formatDuration(ep.duration)}` : ''}
                </div>
              </div>
              <div className="queue-item__actions">
                <button className="icon-btn" onClick={() => player.play(ep)} aria-label="Lire maintenant">
                  <Play size={18} />
                </button>
                <button className="icon-btn" onClick={() => player.moveQueueItem(i, i - 1)} disabled={i === 0} aria-label="Monter">
                  <ChevronDown size={18} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button className="icon-btn" onClick={() => player.moveQueueItem(i, i + 1)} disabled={i === queue.length - 1} aria-label="Descendre">
                  <ChevronDown size={18} />
                </button>
                <button className="icon-btn" onClick={() => player.dequeue(ep.id)} aria-label="Retirer">
                  <X size={18} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
