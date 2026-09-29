import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search as SearchIcon, X } from 'lucide-react';
import { searchEpisodes, searchPodcasts } from '../api/itunes';
import { GENRES } from '../api/genres';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastGrid } from '../components/PodcastCard';
import { EmptyState, ErrorState, Spinner } from '../components/common';
import { useLibrary } from '../store/library';
import { useAsync, useDebounced } from '../utils/hooks';

type Tab = 'podcasts' | 'episodes';

function Results({ term, tab }: { term: string; tab: Tab }) {
  const { country } = useLibrary();
  const podcasts = useAsync((signal) => (tab === 'podcasts' ? searchPodcasts(term, country, signal) : Promise.resolve([])), [term, country, tab]);
  const episodes = useAsync((signal) => (tab === 'episodes' ? searchEpisodes(term, country, signal) : Promise.resolve([])), [term, country, tab]);
  const state = tab === 'podcasts' ? podcasts : episodes;

  if (state.loading) return <Spinner label="Recherche…" />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data?.length) {
    return (
      <EmptyState icon={<SearchIcon size={32} />} title={`Aucun résultat pour « ${term} »`}>
        Vérifiez l'orthographe ou essayez d'autres mots-clés.
      </EmptyState>
    );
  }
  return tab === 'podcasts' ? <PodcastGrid podcasts={podcasts.data ?? []} /> : <EpisodeList episodes={episodes.data ?? []} showPodcast />;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const tab: Tab = params.get('tab') === 'episodes' ? 'episodes' : 'podcasts';
  const term = useDebounced(input.trim());

  // Garde la recherche dans l'URL (partage de lien, bouton retour).
  useEffect(() => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (term) next.set('q', term);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [term, setParams]);

  const setTab = (t: Tab) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('tab', t);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="page">
      <div className="search-box">
        <SearchIcon size={20} />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Podcasts, épisodes, animateurs…"
          aria-label="Rechercher"
          autoFocus
        />
        {input && (
          <button className="icon-btn" onClick={() => setInput('')} aria-label="Effacer">
            <X size={18} />
          </button>
        )}
      </div>

      {term ? (
        <>
          <div className="chips">
            <button className={`chip ${tab === 'podcasts' ? 'chip--active' : ''}`} onClick={() => setTab('podcasts')}>
              Podcasts
            </button>
            <button className={`chip ${tab === 'episodes' ? 'chip--active' : ''}`} onClick={() => setTab('episodes')}>
              Épisodes
            </button>
          </div>
          <Results term={term} tab={tab} />
        </>
      ) : (
        <>
          <h2 className="section-title">Parcourir tout</h2>
          <div className="genre-grid">
            {GENRES.map((g) => (
              <Link key={g.id} to={`/genre/${g.id}`} className="genre-tile" style={{ background: g.color }}>
                {g.name}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
