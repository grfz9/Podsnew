import { useState } from 'react';
import { Link } from 'react-router';
import { Check, FileUp, X } from 'lucide-react';
import { searchPodcasts } from '../api/itunes';
import { Artwork } from '../components/common';
import { matchFeed, parseOpml, type OpmlFeed } from '../lib/opml';
import { useLibrary } from '../store/library';
import { useModeration } from '../store/moderation';
import type { Podcast } from '../types';

interface Row {
  feed: OpmlFeed;
  match?: Podcast;
  status: 'pending' | 'found' | 'missing';
  selected: boolean;
}

/** Import des abonnements depuis une autre application (fichier OPML). */
export function ImportPage() {
  const library = useLibrary();
  const moderation = useModeration();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setDone(null);
    let feeds: OpmlFeed[];
    try {
      feeds = parseOpml(await file.text());
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!feeds.length) {
      setError('Aucun podcast trouvé dans ce fichier.');
      return;
    }
    const initial: Row[] = feeds.map((feed) => ({ feed, status: 'pending', selected: false }));
    setRows(initial);
    setMatching(true);
    // Correspondance avec le catalogue, 4 recherches à la fois.
    const queue = [...initial.keys()];
    const worker = async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        const feed = feeds[i];
        let match: Podcast | undefined;
        try {
          const results = feed.title ? await searchPodcasts(feed.title, library.country) : [];
          match = matchFeed(feed, results);
        } catch {
          match = undefined;
        }
        if (match && !moderation.allowsPodcast(match)) match = undefined;
        const already = match ? library.isSubscribed(match.id) : false;
        setRows((prev) =>
          prev.map((r, j) => (j === i ? { ...r, match, status: match ? 'found' : 'missing', selected: !!match && !already } : r)),
        );
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    setMatching(false);
  };

  const selected = rows.filter((r) => r.selected && r.match);
  const importSelected = () => {
    library.subscribeMany(selected.map((r) => r.match!));
    setDone(selected.length);
    setRows((prev) => prev.map((r) => ({ ...r, selected: false })));
  };

  const found = rows.filter((r) => r.status === 'found').length;
  const missing = rows.filter((r) => r.status === 'missing').length;

  return (
    <div className="page">
      <h1 className="page__title">Importer des abonnements</h1>
      <p className="muted">
        Exportez vos abonnements au format OPML depuis votre application actuelle (Apple Podcasts, Pocket Casts, Overcast, Podcast Addict, AntennaPod…), puis
        choisissez le fichier ci-dessous.
      </p>

      <label className="file-drop">
        <FileUp size={24} />
        <span>Choisir un fichier .opml ou .xml</span>
        <input type="file" accept=".opml,.xml,text/xml,text/x-opml,application/xml" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p className="error-text">{error}</p>}

      {rows.length > 0 && (
        <>
          <p className="small muted">
            {rows.length} podcasts dans le fichier · {found} trouvés · {missing} introuvables
            {matching && ' · recherche en cours…'}
          </p>
          <ul className="import-list">
            {rows.map((r, i) => (
              <li key={r.feed.feedUrl} className={`import-row import-row--${r.status}`}>
                <input
                  type="checkbox"
                  checked={r.selected}
                  disabled={!r.match}
                  onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                  aria-label={`Importer ${r.feed.title}`}
                />
                <Artwork src={r.match?.artwork} alt={r.feed.title} size={44} />
                <div className="import-row__text">
                  <strong>{r.match?.title ?? r.feed.title ?? r.feed.feedUrl}</strong>
                  <span className="small muted">
                    {r.status === 'pending' && 'Recherche…'}
                    {r.status === 'found' && (library.isSubscribed(r.match!.id) ? 'Déjà dans vos abonnements' : r.match!.author)}
                    {r.status === 'missing' && 'Introuvable ou non disponible sur Podsal'}
                  </span>
                </div>
                {r.status === 'found' ? <Check size={18} className="ok-text" /> : r.status === 'missing' ? <X size={18} className="muted" /> : null}
              </li>
            ))}
          </ul>
          <div className="row-actions">
            <button className="btn btn--primary" onClick={importSelected} disabled={!selected.length}>
              Importer {selected.length} podcast{selected.length > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
      {done !== null && (
        <p className="ok-text">
          {done} podcast{done > 1 ? 's' : ''} ajouté{done > 1 ? 's' : ''}. <Link to="/library" className="link">Voir la bibliothèque</Link>
        </p>
      )}
    </div>
  );
}
