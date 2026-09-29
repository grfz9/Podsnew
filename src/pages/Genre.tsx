import { useParams } from 'react-router';
import { getTopPodcasts } from '../api/itunes';
import { getGenre } from '../api/genres';
import { PodcastGrid } from '../components/PodcastCard';
import { ErrorState, Spinner } from '../components/common';
import { useLibrary } from '../store/library';
import { useAsync } from '../utils/hooks';

export function GenrePage() {
  const { id = 'top' } = useParams();
  const { country } = useLibrary();
  const genreId = id === 'top' ? undefined : Number(id);
  const genre = genreId ? getGenre(genreId) : undefined;
  const { data, error, loading, reload } = useAsync((signal) => getTopPodcasts(country, genreId, 100, signal), [country, genreId]);

  return (
    <div className="page">
      <header className="genre-hero" style={{ background: genre?.color ?? '#1db954' }}>
        <span className="small">Catégorie</span>
        <h1>{genre?.name ?? 'Top podcasts'}</h1>
        <p>Les podcasts les plus populaires du moment</p>
      </header>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : <PodcastGrid podcasts={data ?? []} ranked />}
    </div>
  );
}
