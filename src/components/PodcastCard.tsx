import { Link } from 'react-router';
import type { Podcast } from '../types';
import { Artwork } from './common';
import { podcastPath } from '../lib/paths';

export function PodcastCard({ podcast, rank }: { podcast: Podcast; rank?: number }) {
  return (
    <Link to={podcastPath(podcast.id)} className="card" state={{ podcast }}>
      <div className="card__art">
        <Artwork src={podcast.artwork} alt={podcast.title} />
        {rank !== undefined && <span className="card__rank">{rank}</span>}
      </div>
      <div className="card__title" title={podcast.title}>
        {podcast.title}
      </div>
      <div className="card__subtitle">{podcast.author}</div>
    </Link>
  );
}

/** Grille responsive de cartes. */
export function PodcastGrid({ podcasts, ranked = false }: { podcasts: Podcast[]; ranked?: boolean }) {
  return (
    <div className="grid">
      {podcasts.map((p, i) => (
        <PodcastCard key={p.id} podcast={p} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}

/** Rangée défilante horizontalement (style carrousel). */
export function PodcastRow({ podcasts, ranked = false }: { podcasts: Podcast[]; ranked?: boolean }) {
  return (
    <div className="row-scroll">
      {podcasts.map((p, i) => (
        <PodcastCard key={p.id} podcast={p} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}
