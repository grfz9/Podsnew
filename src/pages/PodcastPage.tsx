import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowUpDown, Check, Pause, Play, Plus, Rss, Search, Share2 } from 'lucide-react';
import { getAnyPodcast } from '../api/catalog';
import { EpisodeList } from '../components/EpisodeRow';
import { Reviews } from '../components/Reviews';
import { Artwork, ErrorState, Spinner, Tabs, shareLink } from '../components/common';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import type { Podcast } from '../types';
import { stripHtml } from '../utils/format';
import { useAsync } from '../utils/hooks';

type Filter = 'all' | 'unplayed' | 'in-progress';

export function PodcastPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const library = useLibrary();
  const player = usePlayer();
  const { data, error, loading, reload } = useAsync((signal) => getAnyPodcast(id, library.country, 200, signal), [id, library.country]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [oldestFirst, setOldestFirst] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Infos déjà connues (carte cliquée ou abonnement) pour un affichage immédiat.
  const preview = (location.state as { podcast?: Podcast } | null)?.podcast ?? library.subscriptions.find((p) => p.id === id);
  const podcast: Podcast | undefined = data ? { ...preview, ...data.podcast, description: data.podcast.description || preview?.description } : preview;

  const episodes = useMemo(() => {
    let list = data?.episodes ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
    if (filter === 'unplayed') list = list.filter((e) => !library.progress[e.id]?.completed);
    if (filter === 'in-progress') {
      list = list.filter((e) => {
        const p = library.progress[e.id];
        return p && !p.completed && p.position > 0;
      });
    }
    return oldestFirst ? [...list].reverse() : list;
  }, [data, query, filter, oldestFirst, library.progress]);

  if (!podcast) {
    if (error) return <div className="page"><ErrorState error={error} onRetry={reload} /></div>;
    return <div className="page"><Spinner /></div>;
  }

  const subscribed = library.isSubscribed(podcast.id);
  const latest = data?.episodes.find((e) => !library.progress[e.id]?.completed) ?? data?.episodes[0];
  const latestIsPlaying = latest && player.current?.id === latest.id && player.isPlaying;
  // On garde dans les abonnements une version légère (sans liste d'épisodes).
  const toggleSubscription = () => library.toggleSubscription({ ...podcast, description: podcast.description?.slice(0, 1000) });

  return (
    <div className="page page--flush">
      <header className="podcast-hero">
        <div className="podcast-hero__bg" style={{ backgroundImage: podcast.artwork ? `url(${podcast.artwork})` : undefined }} />
        <Artwork src={podcast.artwork} alt={podcast.title} className="podcast-hero__art" />
        <div className="podcast-hero__info">
          <span className="small">
            {podcast.native ? 'Publié sur Podsnew' : 'Podcast'}
            {podcast.genre ? ` · ${podcast.genre}` : ''}
          </span>
          <h1>{podcast.title}</h1>
          <p className="podcast-hero__author">{podcast.author}</p>
          {data && <p className="small muted">{data.podcast.episodeCount ?? data.episodes.length} épisodes</p>}
        </div>
      </header>

      <div className="podcast-actions">
        {latest && (
          <button
            className="play-btn play-btn--big"
            onClick={() => (latestIsPlaying ? player.pause() : player.play(latest))}
            aria-label={latestIsPlaying ? 'Pause' : 'Lire le dernier épisode non écouté'}
            title="Lire le dernier épisode non écouté"
          >
            {latestIsPlaying ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>
        )}
        <button className={`btn ${subscribed ? 'btn--outline' : 'btn--primary'}`} onClick={toggleSubscription}>
          {subscribed ? <Check size={16} /> : <Plus size={16} />}
          {subscribed ? 'Abonné' : "S'abonner"}
        </button>
        <button className="icon-btn" onClick={() => shareLink(podcast.title, window.location.href).then(setNotice)} aria-label="Partager" title="Partager">
          <Share2 size={20} />
        </button>
        {podcast.feedUrl && (
          <a className="icon-btn" href={podcast.feedUrl} target="_blank" rel="noreferrer" aria-label="Flux RSS" title="Flux RSS">
            <Rss size={20} />
          </a>
        )}
        {notice && <span className="small muted">{notice}</span>}
      </div>

      {podcast.description && <p className="podcast-desc">{stripHtml(podcast.description)}</p>}

      <div className="episodes-toolbar">
        <h2>Épisodes</h2>
        <div className="search-box search-box--small">
          <Search size={16} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un épisode" aria-label="Rechercher un épisode" />
        </div>
        <Tabs
          tabs={[
            { id: 'all', label: 'Tous' },
            { id: 'unplayed', label: 'Non écoutés' },
            { id: 'in-progress', label: 'En cours' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <button className="btn btn--ghost btn--small" onClick={() => setOldestFirst((v) => !v)}>
          <ArrowUpDown size={14} /> {oldestFirst ? 'Plus anciens' : 'Plus récents'}
        </button>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : episodes.length ? (
        <EpisodeList episodes={episodes} />
      ) : (
        <p className="muted pad">Aucun épisode ne correspond.</p>
      )}

      <div className="pad">
        <Reviews podcast={podcast} />
        {podcast.native && (
          <p className="small muted">
            Vous êtes créateur ? <Link to="/studio" className="link">Publiez votre podcast sur Podsnew</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
