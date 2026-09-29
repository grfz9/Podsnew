import { Link } from 'react-router';
import { getPodcast, getTopPodcasts } from '../api/itunes';
import { GENRES } from '../api/genres';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastRow } from '../components/PodcastCard';
import { ErrorState, Section, Spinner } from '../components/common';
import { useLibrary } from '../store/library';
import type { Episode } from '../types';
import { greeting } from '../utils/format';
import { useAsync } from '../utils/hooks';

/** Catégories mises en avant sur l'accueil. */
const FEATURED_GENRES = [1489, 1303, 1487, 1488, 1533];

function TopRow({ country, genreId, title }: { country: string; genreId?: number; title: string }) {
  const { data, error, loading, reload } = useAsync((signal) => getTopPodcasts(country, genreId, 20, signal), [country, genreId]);
  return (
    <Section title={title} action={<Link to={genreId ? `/genre/${genreId}` : '/genre/top'} className="see-all">Tout afficher</Link>}>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : <PodcastRow podcasts={data ?? []} ranked={!genreId} />}
    </Section>
  );
}

function ContinueListening() {
  const { history, progress } = useLibrary();
  const inProgress = history.filter((e) => {
    const p = progress[e.id];
    return p && !p.completed && p.position > 5;
  });
  if (inProgress.length === 0) return null;
  return (
    <Section title="Reprendre l'écoute">
      <EpisodeList episodes={inProgress.slice(0, 4)} showPodcast />
    </Section>
  );
}

/** Derniers épisodes des podcasts auxquels on est abonné. */
function NewFromSubscriptions() {
  const { subscriptions, country, progress } = useLibrary();
  const ids = subscriptions.slice(0, 12).map((p) => p.id);
  const { data, loading } = useAsync(
    async (signal) => {
      const results = await Promise.allSettled(ids.map((id) => getPodcast(id, country, 5, signal)));
      const episodes: Episode[] = results.flatMap((r) => (r.status === 'fulfilled' ? r.value.episodes.slice(0, 3) : []));
      return episodes.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
    },
    [ids.join(','), country],
  );
  if (ids.length === 0) return null;
  const unplayed = (data ?? []).filter((e) => !progress[e.id]?.completed).slice(0, 6);
  return (
    <Section title="Nouveaux épisodes de vos abonnements">
      {loading && !data ? <Spinner /> : unplayed.length ? <EpisodeList episodes={unplayed} showPodcast /> : <p className="muted">Vous êtes à jour 🎉</p>}
    </Section>
  );
}

export function Home() {
  const { country } = useLibrary();
  return (
    <div className="page">
      <h1 className="page__title">{greeting()}</h1>

      <div className="quick-genres">
        {GENRES.slice(0, 8).map((g) => (
          <Link key={g.id} to={`/genre/${g.id}`} className="quick-genre" style={{ background: g.color }}>
            {g.name}
          </Link>
        ))}
      </div>

      <ContinueListening />
      <NewFromSubscriptions />
      <TopRow country={country} title="Top podcasts" />
      {FEATURED_GENRES.map((id) => (
        <TopRow key={id} country={country} genreId={id} title={GENRES.find((g) => g.id === id)!.name} />
      ))}
    </div>
  );
}
