import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { BookOpen, BookOpenText, Clock, Download, FolderOpen, Heart, Mic, User } from 'lucide-react';
import { getReciters, quranPodcastId } from '../api/quran';
import { knownReciterRank } from '../data/reciters';
import { ALL_INTERESTS, type Interest } from '../store/library';
import { getAnyPodcast } from '../api/catalog';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastRow } from '../components/PodcastCard';
import { Artwork, Section, Spinner } from '../components/common';
import { AppMark, Wordmark } from '../components/Wordmark';
import { MixCard, ResumeHero, useResumeEpisode } from '../components/HomeHero';
import { Shortcuts, type Shortcut } from '../components/Shortcuts';
import { useLocalFiles } from '../store/localFiles';
import { useDownloads } from '../store/downloads';
import { buildDailyMix } from '../lib/recommend';
import { useAuth } from '../store/auth';
import { useModeration } from '../store/moderation';
import { PrayerCard } from './Prayer';
import { useLibrary } from '../store/library';
import type { Episode } from '../types';
import { DailyVerse } from '../components/DailyVerse';
import { ReadingPlanCard } from '../components/ReadingPlan';
import { RamadanTeaser } from './Ramadan';
import { useAsync } from '../utils/hooks';
import { hijriDate } from '../utils/format';

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

function ContinueListening({ exclude }: { exclude?: string }) {
  const { history, progress } = useLibrary();
  const { allowsEpisode } = useModeration();
  const inProgress = history.filter((e) => {
    if (!allowsEpisode(e) || e.id === exclude) return false;
    const p = progress[e.id];
    return p && !p.completed && p.position > 5;
  });
  if (inProgress.length === 0) return null;
  return (
    <Section title="Aussi en cours">
      <EpisodeList episodes={inProgress.slice(0, 3)} showPodcast />
    </Section>
  );
}

/** Derniers épisodes des abonnements (partagé par le mix et la section « Nouveautés »). */
function useSubscriptionEpisodes() {
  const { subscriptions, country } = useLibrary();
  const { filterPodcasts } = useModeration();
  const ids = filterPodcasts(subscriptions).slice(0, 15).map((p) => p.id);
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

function DailyMix({ fromSubscriptions, discoveryPodcasts }: { fromSubscriptions?: Episode[]; discoveryPodcasts: string[] }) {
  const library = useLibrary();
  const { progress, country } = library;
  const discovery = useAsync(async (signal) => {
    const results = await Promise.allSettled(discoveryPodcasts.slice(0, 3).map((id) => getAnyPodcast(id, country, 3, signal)));
    return results.flatMap((r) => (r.status === 'fulfilled' ? r.value.episodes.slice(0, 1) : []));
  }, [discoveryPodcasts.slice(0, 3).join(','), country]);

  const { filterEpisodes } = useModeration();
  if (!fromSubscriptions?.length && !discovery.data?.length) return null;
  const mix = buildDailyMix({ fromSubscriptions: filterEpisodes(fromSubscriptions ?? []), discovery: filterEpisodes(discovery.data ?? []), progress });
  if (mix.length < 3) return null;
  return <MixCard mix={mix} subscribedCount={mix.filter((e) => library.isSubscribed(e.podcastId)).length} />;
}

/** Raccourcis de l'accueil : ce qu'on cherche le plus souvent, à portée de pouce. */
function QuickAccess({ interests }: { interests: Interest[] }) {
  const library = useLibrary();
  const { files } = useLocalFiles();
  const { downloads } = useDownloads();
  const items: Shortcut[] = [
    ...(interests.includes('quran')
      ? [
          { to: '/coran', label: 'Écouter le Coran', icon: BookOpen, color: '#e2c485' },
          { to: '/lire', label: 'Lire le Coran', icon: BookOpenText, color: '#c9a86a' },
        ]
      : []),
    ...(interests.includes('islamic') ? [{ to: '/islam', label: 'Podcasts islamiques', icon: Mic, color: '#6cc4b4' }] : []),
    { to: '/priere', label: 'Prière', icon: Clock, color: '#5dcaa5' },
    { to: '/library?tab=saved', label: 'Favoris', icon: Heart, color: '#ed93b1', count: library.savedEpisodes.length },
    { to: '/library?tab=downloads', label: 'Téléchargés', icon: Download, color: '#85b7eb', count: downloads.length },
    { to: '/fichiers', label: 'Mes fichiers', icon: FolderOpen, color: '#f0997b', count: files.length },
  ];
  return <Shortcuts items={items} layout="row" label="Accès rapide" />;
}

/** Récitateurs connus, en accès direct depuis l'accueil. */
function QuranRow() {
  const { data } = useAsync(() => getReciters(), []);
  const known = (data ?? [])
    .map((r) => ({ r, rank: knownReciterRank(r.name) }))
    .filter((x) => x.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)
    .map((x) => x.r);
  if (!known.length) return null;
  return (
    <Section title="Écouter le Coran" action={<Link to="/coran" className="see-all">Tous les récitateurs</Link>}>
      <div className="reciter-strip">
        {known.map((r, i) => (
          <Link key={r.id} to={`/coran/${r.id}`} className="reciter-chip" style={{ '--i': i } as CSSProperties}>
            <Artwork alt="" kind="quran" podcastId={quranPodcastId(r.id)} />
            <span>{r.name}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Bonne nuit';
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export function Home() {
  const library = useLibrary();
  const auth = useAuth();
  const subs = useSubscriptionEpisodes();
  const resume = useResumeEpisode();
  // Ce que l'utilisateur a choisi de voir (fin de la présentation, ou « Moi » → Mon accueil).
  const interests = library.settings.interests.length ? library.settings.interests : ALL_INTERESTS;
  const name = auth.profile?.display_name || auth.profile?.username;

  return (
    <div className="page home">
      <header className="home-head">
        <div className="home-head__top">
          <div className="mobile-brand" aria-label="Podsal">
            <span className="brand__mark">
              <AppMark title="" />
            </span>
            <Wordmark className="mobile-brand__wordmark" title="" />
          </div>
          <Link to="/account" className="home-head__me" aria-label={name ? `Mon espace (${name})` : 'Mon espace'}>
            {name ? <span className="avatar avatar--small">{name.slice(0, 1).toUpperCase()}</span> : <User size={20} />}
          </Link>
        </div>
        <h1 className="page__title home-head__title">As-salāmu ʿalaykum</h1>
        <p className="home-head__date">
          <span>
            {greeting()}
            {name ? ` ${name}` : ''} · {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
          </span>
          {hijriDate() && <span className="home-head__hijri">{hijriDate()}</span>}
        </p>
      </header>

      {resume && <ResumeHero episode={resume} />}
      <PrayerCard />
      <RamadanTeaser />
      <QuickAccess interests={interests} />
      {(interests.includes('quran') || interests.includes('islamic')) && <DailyVerse />}
      <ReadingPlanCard compact />

      <ContinueListening exclude={resume?.id} />
      {interests.includes('quran') && <QuranRow />}
      {interests.includes('islamic') && <IslamicPodcasts />}
      <DailyMix fromSubscriptions={subs.data} discoveryPodcasts={[]} />
      <NewFromSubscriptions episodes={subs.data} loading={subs.loading} />
    </div>
  );
}
