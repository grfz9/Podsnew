import { Link } from 'react-router';
import { BookOpen, Mic, Play } from 'lucide-react';
import { getAnyPodcast } from '../api/catalog';
import { getTopPodcasts } from '../api/itunes';
import { GENRES, getGenre } from '../api/genres';
import { latestNativePodcasts } from '../api/native';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastRow } from '../components/PodcastCard';
import { ErrorState, Section, Spinner } from '../components/common';
import { buildDailyMix, excludeKnown, recommendationSeeds, type Seed } from '../lib/recommend';
import { useAuth } from '../store/auth';
import { useModeration } from '../store/moderation';
import { PrayerCard } from './Prayer';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import type { Episode } from '../types';
import { useAsync } from '../utils/hooks';

/** Catégories mises en avant sur l'accueil. */
const FEATURED_GENRES = [1489, 1303, 1487];

function TopRow({ country, genreId, title }: { country: string; genreId?: number; title: string }) {
  const { filterPodcasts } = useModeration();
  const { data, error, loading, reload } = useAsync((signal) => getTopPodcasts(country, genreId, 30, signal), [country, genreId]);
  return (
    <Section title={title} action={<Link to={genreId ? `/genre/${genreId}` : '/genre/top'} className="see-all">Tout afficher</Link>}>
      {loading && !data ? <Spinner /> : error ? <ErrorState error={error} onRetry={reload} /> : <PodcastRow podcasts={filterPodcasts(data ?? []).slice(0, 20)} />}
    </Section>
  );
}

/** Podcasts islamiques validés par la modération. */
function IslamicPodcasts() {
  const { validated, loading } = useModeration();
  if (loading && !validated.length) return null;
  return (
    <Section title="Podcasts islamiques" action={<Link to="/islam" className="see-all">Tout afficher</Link>}>
      {validated.length ? (
        <PodcastRow podcasts={validated.slice(0, 12)} />
      ) : (
        <p className="muted">
          Les podcasts sont ajoutés un par un après vérification.{' '}
          <Link to="/islam" className="link">
            Proposer un podcast
          </Link>
        </p>
      )}
    </Section>
  );
}

function ContinueListening() {
  const { history, progress } = useLibrary();
  const { allowsEpisode } = useModeration();
  const inProgress = history.filter((e) => {
    if (!allowsEpisode(e)) return false;
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
  const { filterEpisodes } = useModeration();
  if (subscriptions.length === 0) return null;
  const unplayed = filterEpisodes(episodes ?? []).filter((e) => !progress[e.id]?.completed).slice(0, 5);
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

  const { filterEpisodes } = useModeration();
  if (!fromSubscriptions?.length && !discovery.data?.length) return null;
  const mix = buildDailyMix({ fromSubscriptions: filterEpisodes(fromSubscriptions ?? []), discovery: filterEpisodes(discovery.data ?? []), progress });
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

function NativeCreators() {
  const auth = useAuth();
  const { filterPodcasts } = useModeration();
  const { data } = useAsync(() => (auth.enabled ? latestNativePodcasts(12) : Promise.resolve([])), [auth.enabled]);
  const list = filterPodcasts(data ?? []);
  if (!list.length) return null;
  return (
    <Section title="Publiés sur Podsal" action={<Link to="/studio" className="see-all">Publier le vôtre</Link>}>
      <PodcastRow podcasts={list} />
    </Section>
  );
}

export function Home() {
  const library = useLibrary();
  const { filterPodcasts } = useModeration();
  const subs = useSubscriptionEpisodes();
  const seeds = recommendationSeeds(library.state.stats, library.subscriptions, 2);
  const recs = useRecommendations(seeds);
  const recRows = (recs.data ?? []).map((r) => ({ ...r, podcasts: filterPodcasts(r.podcasts) })).filter((r) => r.podcasts.length > 0);
  const discoveryIds = recRows.flatMap((r) => r.podcasts.slice(0, 2).map((p) => p.id));

  return (
    <div className="page">
      <h1 className="page__title">Accueil</h1>

      <PrayerCard />

      <div className="quick-genres">
        <Link to="/coran" className="quick-genre quick-genre--main">
          <BookOpen size={18} /> Coran
        </Link>
        <Link to="/islam" className="quick-genre quick-genre--main">
          <Mic size={18} /> Podcasts islamiques
        </Link>
        {GENRES.slice(0, 6).map((g) => (
          <Link key={g.id} to={`/genre/${g.id}`} className="quick-genre" style={{ background: g.color }}>
            {g.name}
          </Link>
        ))}
      </div>

      <ContinueListening />
      <IslamicPodcasts />
      <DailyMix fromSubscriptions={subs.data} discoveryPodcasts={discoveryIds} />
      <NewFromSubscriptions episodes={subs.data} loading={subs.loading} />
      {recRows.map(({ seed, podcasts }) => (
        <Section
          key={seed.podcast.id}
          title={`Parce que vous écoutez ${seed.podcast.title}`}
          action={<Link to={`/genre/${seed.genreId}`} className="see-all">{getGenre(seed.genreId)?.name}</Link>}
        >
          <PodcastRow podcasts={podcasts} />
        </Section>
      ))}
      <NativeCreators />
      <TopRow country={library.country} title="Podcasts populaires" />
      {FEATURED_GENRES.map((id) => (
        <TopRow key={id} country={library.country} genreId={id} title={getGenre(id)!.name} />
      ))}
    </div>
  );
}
