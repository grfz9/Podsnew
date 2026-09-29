import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FileText, Search as SearchIcon, X } from 'lucide-react';
import { searchAllPodcasts } from '../api/catalog';
import { searchEpisodes } from '../api/itunes';
import { GENRES } from '../api/genres';
import { GenreTile } from '../components/GenreTile';
import { searchTranscripts } from '../api/ai';
import { searchLocalTranscripts } from '../lib/feed';
import { EpisodeList, EpisodeRow, episodePath } from '../components/EpisodeRow';
import { PodcastGrid } from '../components/PodcastCard';
import { EmptyState, ErrorState, Spinner, Tabs } from '../components/common';
import { useAuth } from '../store/auth';
import { useModeration } from '../store/moderation';
import { useLibrary } from '../store/library';
import { formatTime } from '../utils/format';
import { useAsync, useDebounced } from '../utils/hooks';

type Tab = 'podcasts' | 'episodes' | 'transcripts';

function NoResults({ term }: { term: string }) {
  return (
    <EmptyState icon={<SearchIcon size={32} />} title={`Aucun résultat pour « ${term} »`}>
      Vérifiez l'orthographe ou essayez d'autres mots-clés.
    </EmptyState>
  );
}

/** Met en valeur les termes trouvés (marqués [[ ]] par le serveur) sans interpréter de HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/\[\[|\]\]/);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : p))}
    </>
  );
}

function TranscriptResults({ term }: { term: string }) {
  const auth = useAuth();
  const moderation = useModeration();
  const { data, error, loading, reload } = useAsync(async () => {
    const [server, local] = await Promise.all([
      auth.enabled ? searchTranscripts(term) : Promise.resolve([]),
      searchLocalTranscripts(term),
    ]);
    const seen = new Set(server.map((h) => h.episode.id));
    return [
      ...server,
      ...local.filter((l) => !seen.has(l.episode.id)).map((l) => ({ episode: l.episode, snippet: l.text, startAt: l.start })),
    ].filter((h) => moderation.allowsEpisode(h.episode));
  }, [term, auth.enabled]);

  if (loading) return <Spinner label="Recherche dans les transcriptions…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data?.length) {
    return (
      <EmptyState icon={<FileText size={32} />} title={`« ${term} » n'apparaît dans aucune transcription indexée`}>
        La recherche porte sur les épisodes dont l'éditeur publie une transcription et qui ont déjà été consultés sur Podsal.
      </EmptyState>
    );
  }
  return (
    <div className="episode-list">
      {data.map((hit) => (
        <EpisodeRow
          key={hit.episode.id}
          episode={hit.episode}
          showPodcast
          startAt={hit.startAt ?? undefined}
          excerpt={
            <>
              {hit.startAt !== null && hit.startAt >= 0 && (
                <Link to={`${episodePath(hit.episode)}?q=${encodeURIComponent(term)}&t=${Math.floor(hit.startAt)}`} className="transcript__time">
                  {formatTime(hit.startAt)}
                </Link>
              )}{' '}
              « <Snippet text={hit.snippet} /> »
            </>
          }
        />
      ))}
    </div>
  );
}

function Results({ term, tab }: { term: string; tab: Tab }) {
  const { country } = useLibrary();
  const moderation = useModeration();
  const podcasts = useAsync((signal) => (tab === 'podcasts' ? searchAllPodcasts(term, country, signal) : Promise.resolve([])), [term, country, tab]);
  const episodes = useAsync((signal) => (tab === 'episodes' ? searchEpisodes(term, country, signal) : Promise.resolve([])), [term, country, tab]);

  if (tab === 'transcripts') return <TranscriptResults term={term} />;
  const state = tab === 'podcasts' ? podcasts : episodes;
  const podcastList = moderation.filterPodcasts(podcasts.data ?? []);
  const episodeList = moderation.filterEpisodes(episodes.data ?? []);
  if (state.loading) return <Spinner label="Recherche…" />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!(tab === 'podcasts' ? podcastList : episodeList).length) return <NoResults term={term} />;
  return tab === 'podcasts' ? <PodcastGrid podcasts={podcastList} /> : <EpisodeList episodes={episodeList} showPodcast />;
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'episodes' || tabParam === 'transcripts' ? tabParam : 'podcasts';
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
          placeholder={tab === 'transcripts' ? 'Un sujet, une personne, une citation…' : 'Podcasts, épisodes, animateurs…'}
          aria-label="Rechercher"
          autoFocus
        />
        {input && (
          <button className="icon-btn" onClick={() => setInput('')} aria-label="Effacer">
            <X size={18} />
          </button>
        )}
      </div>

      <Tabs
        tabs={[
          { id: 'podcasts', label: 'Podcasts' },
          { id: 'episodes', label: 'Épisodes' },
          { id: 'transcripts', label: 'Dans les épisodes' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {term ? (
        <Results term={term} tab={tab} />
      ) : tab === 'transcripts' ? (
        <p className="muted">
          Retrouvez dans quel épisode un sujet est abordé, et à quel moment, grâce aux transcriptions publiées par les éditeurs.
        </p>
      ) : (
        <>
          <h2 className="section-title">Parcourir les catégories</h2>
          <div className="genre-grid">
            {GENRES.map((g, i) => (
              <GenreTile key={g.id} genre={g} size="large" index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
