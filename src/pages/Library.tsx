import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Bell, ChartColumn, Clock, Download, FileDown, FileUp, Heart, Library as LibraryIcon, ListMusic, Play, Scissors, Trash } from 'lucide-react';
import { PlaylistGrid } from '../components/Playlists';
import { COUNTRIES } from '../api/genres';
import { lookupPodcasts } from '../api/itunes';
import { EpisodeList, EpisodeRow } from '../components/EpisodeRow';
import { PodcastGrid } from '../components/PodcastCard';
import { clipPath } from '../components/EpisodeExtras';
import { Artwork, EmptyState, Tabs, formatBytes, shareLink } from '../components/common';
import { LocalFilesPanel } from './LocalFiles';
import { PremiumTeaser } from '../components/Premium';
import { FREE_DOWNLOADS, usePremium } from '../store/premium';
import { buildOpml } from '../lib/opml';
import { notificationsSupported, registerBackgroundCheck, requestNotificationPermission } from '../lib/notifications';
import { useDownloads } from '../store/downloads';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { formatReleaseDate, formatTime } from '../utils/format';

const TABS = [
  { id: 'subscriptions', label: 'Abonnements' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'downloads', label: 'Téléchargements' },
  { id: 'files', label: 'Mes fichiers' },
  { id: 'saved', label: 'Favoris' },
  { id: 'clips', label: 'Extraits' },
  { id: 'history', label: 'Historique' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Playlists() {
  const library = useLibrary();
  const [name, setName] = useState('');
  return (
    <>
      <form
        className="form form--inline"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          library.createPlaylist(name);
          setName('');
        }}
      >
        <label>
          Nouvelle playlist
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex. Tafsir du soir" />
        </label>
        <button className="btn btn--primary btn--small" type="submit" disabled={!name.trim()}>
          Créer
        </button>
      </form>
      {library.playlists.length ? (
        <PlaylistGrid playlists={library.playlists} linkTo={(p) => `/playlist/${p.id}`} />
      ) : (
        <EmptyState icon={<ListMusic size={32} />} title="Aucune playlist">
          Créez une playlist, puis ajoutez-y des épisodes ou des sourates avec « Ajouter à une playlist ». Vos amis pourront l'écouter.
        </EmptyState>
      )}
    </>
  );
}

function Downloads() {
  const { downloads, usage, remove } = useDownloads();
  const { isPremium } = usePremium();
  if (!downloads.length) {
    return (
      <EmptyState icon={<Download size={32} />} title="Aucun épisode téléchargé">
        Touchez l'icône de téléchargement d'un épisode pour l'écouter sans connexion.
      </EmptyState>
    );
  }
  const total = downloads.reduce((sum, d) => sum + d.size, 0);
  return (
    <>
      <p className="small muted">
        {downloads.length}
        {!isPremium && ` sur ${FREE_DOWNLOADS}`} épisode{downloads.length > 1 ? 's' : ''}
        {total > 0 && ` · ${formatBytes(total)}`}
        {usage && usage.quota > 0 && ` · espace utilisé par l'application : ${formatBytes(usage.used)} sur ${formatBytes(usage.quota)} disponibles`}
      </p>
      {!isPremium && downloads.length >= FREE_DOWNLOADS && (
        <PremiumTeaser title="Téléchargements illimités avec Podsal+">
          Sans abonnement, {FREE_DOWNLOADS} épisodes ou sourates peuvent être gardés hors-ligne.
        </PremiumTeaser>
      )}
      <div className="episode-list">
        {downloads.map((d) => (
          <EpisodeRow key={d.id} episode={d.episode} showPodcast />
        ))}
      </div>
      <button className="btn btn--outline btn--small" onClick={() => downloads.forEach((d) => remove(d.id))}>
        <Trash size={14} /> Tout supprimer
      </button>
    </>
  );
}

function Clips() {
  const library = useLibrary();
  const player = usePlayer();
  const [notice, setNotice] = useState<string | null>(null);
  if (!library.clips.length) {
    return (
      <EmptyState icon={<Scissors size={32} />} title="Aucun extrait">
        Depuis la page d'un épisode, choisissez un passage pour le réécouter ou le partager.
      </EmptyState>
    );
  }
  return (
    <div className="clip-list">
      {notice && <p className="small muted">{notice}</p>}
      {library.clips.map((c) => {
        const path = clipPath(c.episode, c.start, c.end, c.note);
        return (
          <article key={c.id} className="queue-item">
            <Artwork alt={c.episode.podcastTitle} size={48} podcastId={c.episode.podcastId} genre={c.episode.genre} />
            <div className="queue-item__text">
              <Link to={path} className="queue-item__title">
                {c.episode.title}
              </Link>
              <div className="small muted">
                {formatTime(c.start)} – {formatTime(c.end)} · {c.episode.podcastTitle} · {formatReleaseDate(new Date(c.createdAt).toISOString())}
              </div>
              {c.note && <div className="small">{c.note}</div>}
            </div>
            <div className="queue-item__actions">
              <button className="icon-btn" onClick={() => player.playSegment(c.episode, c.start, c.end)} aria-label="Écouter l'extrait">
                <Play size={18} />
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={() => shareLink(c.episode.title, `${location.origin}${location.pathname}#${path}`).then(setNotice)}
              >
                Partager
              </button>
              <button className="icon-btn" onClick={() => library.removeClip(c.id)} aria-label="Supprimer l'extrait">
                <Trash size={16} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Settings() {
  const library = useLibrary();
  const [exporting, setExporting] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  const toggleNotifications = async (enabled: boolean) => {
    setNotifyError(null);
    if (enabled) {
      const granted = await requestNotificationPermission().catch(() => false);
      if (!granted) {
        setNotifyError('Autorisez les notifications pour Podsal dans les réglages de votre navigateur ou de votre téléphone.');
        return;
      }
      void registerBackgroundCheck();
    }
    library.setSettings({ notifications: enabled });
  };

  const exportOpml = async () => {
    setExporting(true);
    try {
      // Les podcasts ajoutés depuis un classement n'ont pas toujours leur adresse de flux : on la complète.
      const missing = library.subscriptions.filter((p) => !p.feedUrl && !p.native).map((p) => p.id);
      const found = await lookupPodcasts(missing, library.country).catch(() => []);
      const byId = new Map(found.map((p) => [p.id, p]));
      const podcasts = library.subscriptions.map((p) => ({ ...p, feedUrl: p.feedUrl ?? byId.get(p.id)?.feedUrl }));
      const blob = new Blob([buildOpml(podcasts)], { type: 'text/x-opml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'podsnew-abonnements.opml';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally {
      setExporting(false);
    }
  };

  return (
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
      {notificationsSupported() && (
        <label className="setting">
          <span>
            <Bell size={16} /> Nouveaux épisodes
            <span className="small muted"> — notification quand un podcast suivi publie un épisode</span>
          </span>
          <input type="checkbox" className="switch" checked={library.settings.notifications} onChange={(e) => toggleNotifications(e.target.checked)} />
        </label>
      )}
      {notifyError && <p className="small error-text">{notifyError}</p>}
      <div className="setting">
        <span>
          Abonnements
          <span className="small muted"> — au format OPML, compatible avec les autres applications de podcasts</span>
        </span>
        <span className="row-actions">
          <Link to="/import" className="btn btn--outline btn--small">
            <FileUp size={14} /> Importer
          </Link>
          <button className="btn btn--outline btn--small" onClick={exportOpml} disabled={!library.subscriptions.length || exporting}>
            <FileDown size={14} /> Exporter
          </button>
        </span>
      </div>
      <p className="small muted">
        Raccourcis clavier : <kbd>Espace</kbd> lecture/pause · <kbd>←</kbd> reculer de 15 s · <kbd>→</kbd> avancer de 30 s · <kbd>M</kbd> couper le son · <kbd>↑</kbd> <kbd>↓</kbd> volume (grand lecteur) · <kbd>F</kbd> plein écran (vidéo)
      </p>
    </section>
  );
}

export function LibraryPage() {
  const library = useLibrary();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'subscriptions') as TabId;

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Bibliothèque</h1>
        <Link to="/stats" className="btn btn--outline btn--small">
          <ChartColumn size={14} /> Statistiques d'écoute
        </Link>
      </div>
      <Tabs tabs={[...TABS]} value={tab} onChange={(id) => setParams({ tab: id }, { replace: true })} />

      {tab === 'subscriptions' &&
        (library.subscriptions.length ? (
          <PodcastGrid podcasts={library.subscriptions} />
        ) : (
          <EmptyState icon={<LibraryIcon size={32} />} title="Aucun abonnement">
            Appuyez sur « S'abonner » sur la page d'un podcast, ou <Link to="/import" className="link">importez vos abonnements</Link> depuis une autre application.
          </EmptyState>
        ))}

      {tab === 'playlists' && <Playlists />}

      {tab === 'downloads' && <Downloads />}

      {tab === 'files' && <LocalFilesPanel />}

      {tab === 'saved' &&
        (library.savedEpisodes.length ? (
          <EpisodeList episodes={library.savedEpisodes} showPodcast />
        ) : (
          <EmptyState icon={<Heart size={32} />} title="Aucun épisode favori">
            Appuyez sur le cœur d'un épisode pour l'écouter plus tard.
          </EmptyState>
        ))}

      {tab === 'clips' && <Clips />}

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

      <Settings />
    </div>
  );
}
