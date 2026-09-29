import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { getAnyPodcast } from '../api/catalog';
import { getTopPodcasts } from '../api/itunes';
import { GENRES, getGenre } from '../api/genres';
import { latestNativePodcasts } from '../api/native';
import { getFeed } from '../api/social';
import { ActivityItem } from '../components/Activity';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastRow } from '../components/PodcastCard';
import { ErrorState, Section, Spinner } from '../components/common';
import { buildDailyMix, excludeKnown, recommendationSeeds, type Seed } from '../lib/recommend';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import type { Episode } from '../types';
import { useAsync } from '../utils/hooks';

/** Catégories mises en avant sur l'accueil. */
const FEATURED_GENRES = [1489, 1303, 1487];

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
      <EpisodeList episodes={inProgress.slice(0, 3)} showPodcast />
    </Section>
  );
}

/** Derniers épisodes des abonnements (partagé par le mix et la section « Nouveautés »). */
function useSubscriptionEpisodes() {
  const { subscriptions, country } = useLibrary();
  const ids = subscriptions.slice(0, 15).map((p) => p.id);
  return useAsync(async (signal) => {
    const results = await Promise.allSettled(ids.map((id) => getAnyPodcast(id, country, 5, signal)));
    return results
      .flatMap((r) => (r.status === 'fulfilled' ? r.value.episodes.slice(0, 3) : []))
      .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  }, [ids.join(','), country]);
}

function NewFromSubscriptions({ episodes, loading }: { episodes?: Episode[]; loading: boolean }) {
  const { subscriptions, progress } = useLibrary();
  if (subscriptions.length === 0) return null;
  const unplayed = (episodes ?? []).filter((e) => !progress[e.id]?.completed).slice(0, 5);
  return (
    <Section title="Nouveaux épisodes de vos abonnements">
      {loading && !episodes ? <Spinner /> : unplayed.length ? <EpisodeList episodes={unplayed} showPodcast /> : <p className="muted">Vous avez écouté tous les derniers épisodes.</p>}
    </Section>
  );
}

function useRecommendations(seeds: Seed[]) {
  const { subscriptions, country } = useLibrary();
  const known = new Set(subscriptions.map((p) => p.id));
  return useAsync(async (signal) => {
    const rows = await Promise.all(
      seeds.map(async (seed) => {
        const top = await getTopPodcasts(country, seed.genreId, 50, signal).catch(() => []);
        known.add(seed.podcast.id);
        return { seed, podcasts: excludeKnown(top, known).slice(0, 12) };
      }),
    );
    return rows.filter((r) => r.podcasts.length > 0);
  }, [seeds.map((s) => `${s.podcast.id}:${s.genreId}`).join(','), subscriptions.length, country]);
}

function DailyMix({ fromSubscriptions, discoveryPodcasts }: { fromSubscriptions?: Episode[]; discoveryPodcasts: string[] }) {
  const library = useLibrary();
  const { progress, country } = library;
  const player = usePlayer();
  const discovery = useAsync(async (signal) => {
    const results = await Promise.allSettled(discoveryPodcasts.slice(0, 3).map((id) => getAnyPodcast(id, country, 3, signal)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value.episodes.slice(0, 1) : []));
  }, [discoveryPodcasts.slice(0, 3).join(','), country]);

  if (!fromSubscriptions?.length && !discovery.data?.length) return null;
  const mix = buildDailyMix({ fromSubscriptions: fromSubscriptions ?? [], discovery: discovery.data ?? [], progress });
  if (mix.length < 3) return null;
  const discoveries = mix.filter((e) => !library.isSubscribed(e.podcastId)).length;

  return (
    <Section
      title="Votre mix du jour"
      action={
        <button className="btn btn--primary btn--small" onClick={() => player.playAll(mix)}>
          <Play size={14} fill="currentColor" /> Tout lire
        </button>
      }
    >
      <p className="small muted section__intro">
        {mix.length} épisodes : {mix.length - discoveries} de vos abonnements
        {discoveries > 0 && `, ${discoveries} découverte${discoveries > 1 ? 's' : ''} dans les catégories que vous écoutez`}. Renouvelé chaque jour.
      </p>
      <EpisodeList episodes={mix} showPodcast />
    </Section>
  );
}

function FriendsActivity() {
  const auth = useAuth();
  const feed = useAsync(() => (auth.userId ? getFeed(auth.userId, 5) : Promise.resolve([])), [auth.userId]);
  if (!auth.userId || !feed.data?.length) return null;
  return (
    <Section title="Activité de vos amis" action={<Link to="/friends" className="see-all">Tout afficher</Link>}>
      <div className="activity-list">
        {feed.data.map((row) => (
          <ActivityItem key={row.id} row={row} />
        ))}
      </div>
    </Section>
  );
}

function NativeCreators() {
  const auth = useAuth();
  const { data } = useAsync(() => (auth.enabled ? latestNativePodcasts(12) : Promise.resolve([])), [auth.enabled]);
  if (!data?.length) return null;
  return (
    <Section title="Publiés sur Podsnew" action={<Link to="/studio" className="see-all">Publier le vôtre</Link>}>
      <PodcastRow podcasts={data} />
    </Section>
  );
}

export function Home() {
  const library = useLibrary();
  const subs = useSubscriptionEpisodes();
  const seeds = recommendationSeeds(library.state.stats, library.subscriptions, 2);
  const recs = useRecommendations(seeds);
  const discoveryIds = (recs.data ?? []).flatMap((r) => r.podcasts.slice(0, 2).map((p) => p.id));

  return (
    <div className="page">
      <h1 className="page__title">Accueil</h1>

      <div className="quick-genres">
        {GENRES.slice(0, 8).map((g) => (
          <Link key={g.id} to={`/genre/${g.id}`} className="quick-genre" style={{ background: g.color }}>
            {g.name}
          </Link>
        ))}
      </div>

      <ContinueListening />
      <DailyMix fromSubscriptions={subs.data} discoveryPodcasts={discoveryIds} />
      <NewFromSubscriptions episodes={subs.data} loading={subs.loading} />
      <FriendsActivity />
      {(recs.data ?? []).map(({ seed, podcasts }) => (
        <Section
          key={seed.podcast.id}
          title={`Parce que vous écoutez ${seed.podcast.title}`}
          action={<Link to={`/genre/${seed.genreId}`} className="see-all">{getGenre(seed.genreId)?.name}</Link>}
        >
          <PodcastRow podcasts={podcasts} />
        </Section>
      ))}
      <NativeCreators />
      <TopRow country={library.country} title="Top podcasts" />
      {FEATURED_GENRES.map((id) => (
        <TopRow key={id} country={library.country} genreId={id} title={getGenre(id)!.name} />
      ))}
    </div>
  );
}
