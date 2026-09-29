import { useParams } from 'react-router';
import { getTopPodcasts } from '../api/itunes';
import { COUNTRIES, getGenre } from '../api/genres';
import { PodcastGrid } from '../components/PodcastCard';
import { ErrorState, Spinner } from '../components/common';
import { useLibrary } from '../store/library';
import { useAsync } from '../utils/hooks';

export function GenrePage() {
  const { id = 'top' } = useParams();
  const { country } = useLibrary();
  const genreId = id === 'top' ? undefined : Number(id);
  const genre = genreId ? getGenre(genreId) : undefined;
  const countryName = COUNTRIES.find((c) => c.code === country)?.name ?? country.toUpperCase();
  const { data, error, loading, reload } = useAsync((signal) => getTopPodcasts(country, genreId, 100, signal), [country, genreId]);

  return (
    <div className="page">
      <header className="genre-hero" style={{ background: genre?.color ?? '#1f7a4d' }}>
        <h1>{genre?.name ?? 'Top podcasts'}</h1>
        <p>
          Classement Apple Podcasts · {countryName}
          {data ? ` · ${data.length} podcasts` : ''}
        </p>
      </header>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : <PodcastGrid podcasts={data ?? []} ranked />}
    </div>
  );
}
