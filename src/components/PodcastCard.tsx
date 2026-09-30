import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { Podcast } from '../types';
import { Artwork } from './common';
import { podcastPath } from '../lib/paths';

export function PodcastCard({ podcast, rank, index = 0 }: { podcast: Podcast; rank?: number; index?: number }) {
  return (
    <Link to={podcastPath(podcast.id)} className="card" state={{ podcast }} style={{ '--i': Math.min(index, 12) } as CSSProperties}>
      <div className="card__art">
        <Artwork alt={podcast.title} podcastId={podcast.id} genre={podcast.genre} genreIds={podcast.genreIds} />
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
        <PodcastCard key={p.id} podcast={p} rank={ranked ? i + 1 : undefined} index={i} />
      ))}
    </div>
  );
}

/** Rangée défilante horizontalement (style carrousel). */
export function PodcastRow({ podcasts, ranked = false }: { podcasts: Podcast[]; ranked?: boolean }) {
  return (
    <div className="row-scroll">
      {podcasts.map((p, i) => (
        <PodcastCard key={p.id} podcast={p} rank={ranked ? i + 1 : undefined} index={i} />
      ))}
    </div>
  );
}

/** Emplacements de cartes pendant le chargement (plutôt qu'un indicateur qui tourne). */
export function SkeletonCards({ count = 6, row = true }: { count?: number; row?: boolean }) {
  return (
    <div className={row ? 'row-scroll' : 'grid'} role="status" aria-label="Chargement…">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card--skeleton" aria-hidden>
          <div className="card__art skeleton" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}
