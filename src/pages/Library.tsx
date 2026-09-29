import { useSearchParams } from 'react-router';
import { Clock, Heart, Library as LibraryIcon } from 'lucide-react';
import { COUNTRIES } from '../api/genres';
import { EpisodeList } from '../components/EpisodeRow';
import { PodcastGrid } from '../components/PodcastCard';
import { EmptyState } from '../components/common';
import { useLibrary } from '../store/library';

const TABS = [
  { id: 'subscriptions', label: 'Abonnements' },
  { id: 'saved', label: 'Favoris' },
  { id: 'history', label: 'Historique' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function LibraryPage() {
  const library = useLibrary();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'subscriptions') as TabId;

  return (
    <div className="page">
      <h1 className="page__title">Bibliothèque</h1>
      <div className="chips">
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? 'chip--active' : ''}`} onClick={() => setParams({ tab: t.id }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subscriptions' &&
        (library.subscriptions.length ? (
          <PodcastGrid podcasts={library.subscriptions} />
        ) : (
          <EmptyState icon={<LibraryIcon size={32} />} title="Aucun abonnement">
            Appuyez sur « S'abonner » sur la page d'un podcast pour le retrouver ici.
          </EmptyState>
        ))}

      {tab === 'saved' &&
        (library.savedEpisodes.length ? (
          <EpisodeList episodes={library.savedEpisodes} showPodcast />
        ) : (
          <EmptyState icon={<Heart size={32} />} title="Aucun épisode favori">
            Appuyez sur le cœur d'un épisode pour l'écouter plus tard.
          </EmptyState>
        ))}

      {tab === 'history' &&
        (library.history.length ? (
          <>
            <button className="btn btn--outline btn--small" onClick={library.clearHistory}>
              Effacer l'historique
            </button>
            <EpisodeList episodes={library.history} showPodcast />
          </>
        ) : (
          <EmptyState icon={<Clock size={32} />} title="Aucun épisode écouté">
            Les épisodes que vous écoutez apparaîtront ici.
          </EmptyState>
        ))}

      <section className="settings">
        <h2>Réglages</h2>
        <label className="setting">
          <span>
            Pays du catalogue
            <span className="small muted"> — classements et résultats de recherche</span>
          </span>
          <select value={library.country} onChange={(e) => library.setCountry(e.target.value)}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="small muted">
          Raccourcis clavier : <kbd>Espace</kbd> lecture/pause · <kbd>←</kbd> reculer de 15 s · <kbd>→</kbd> avancer de 30 s
        </p>
      </section>
    </div>
  );
}
