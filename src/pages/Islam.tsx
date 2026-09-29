import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, Check, Search, ShieldCheck, X } from 'lucide-react';
import { searchPodcasts, getPodcast, lookupPodcasts } from '../api/itunes';
import { mySuggestions, pendingSuggestions, setSuggestionStatus, suggestPodcast, unblockPodcast, unvalidatePodcast, validatePodcast, type SuggestionRow } from '../api/moderation';
import { PodcastGrid } from '../components/PodcastCard';
import { Artwork, EmptyState, ErrorState, Spinner, Tabs } from '../components/common';
import { isMusicPodcast } from '../api/genres';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { useModeration } from '../store/moderation';
import type { Podcast } from '../types';
import { formatReleaseDate } from '../utils/format';
import { useAsync, useDebounced } from '../utils/hooks';

/** Recherche dans tout le catalogue (y compris religieux), sans musique ni contenu explicite. */
function useCatalogSearch(term: string) {
  const { country } = useLibrary();
  return useAsync(() => (term.length >= 2 ? searchPodcasts(term, country) : Promise.resolve([] as Podcast[])), [term, country]);
}

const STATUS_LABEL: Record<SuggestionRow['status'], string> = {
  pending: 'En attente de vérification',
  approved: 'Validé',
  rejected: 'Non retenu',
};

/* ---------- Podcasts islamiques ---------- */

export function IslamPage() {
  const moderation = useModeration();
  const auth = useAuth();
  const [params] = useSearchParams();
  const [proposing, setProposing] = useState(!!params.get('proposer'));
  const { reload } = moderation;
  useEffect(reload, [reload]);

  return (
    <div className="page">
      <h1 className="page__title">Podcasts islamiques</h1>
      <p className="muted">
        Des cours et rappels fondés sur le Coran et la Sunnah, selon la compréhension des pieux prédécesseurs. Chaque podcast est vérifié avant d'être
        ajouté.
      </p>

      <Link to="/coran" className="prayer-card prayer-card--setup quran-link">
        <BookOpen size={20} />
        <span>
          <strong>Écouter le Coran</strong>
          <span className="small muted">Par récitateur, avec le texte arabe et la traduction du sens.</span>
        </span>
      </Link>

      {moderation.loading && !moderation.validated.length ? (
        <Spinner />
      ) : moderation.validated.length ? (
        <PodcastGrid podcasts={moderation.validated} />
      ) : (
        <EmptyState icon={<ShieldCheck size={32} />} title="Aucun podcast validé pour l'instant">
          La liste est constituée podcast par podcast.
        </EmptyState>
      )}

      <section className="settings">
        <h2>Proposer un podcast</h2>
        {!auth.enabled ? (
          <p className="muted small">Les propositions nécessitent l'activation des comptes.</p>
        ) : !auth.userId ? (
          <p className="muted small">
            <Link to="/account" className="link">
              Connectez-vous
            </Link>{' '}
            pour proposer un podcast à la vérification.
          </p>
        ) : proposing ? (
          <ProposeForm initialId={params.get('proposer') ?? undefined} onClose={() => setProposing(false)} />
        ) : (
          <button className="btn btn--outline" onClick={() => setProposing(true)}>
            Proposer un podcast
          </button>
        )}
        {auth.userId && <MySuggestions />}
      </section>
    </div>
  );
}

function ProposeForm({ initialId, onClose }: { initialId?: string; onClose: () => void }) {
  const auth = useAuth();
  const moderation = useModeration();
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const results = useCatalogSearch(term);
  const [selected, setSelected] = useState<Podcast | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialId || initialId.startsWith('c-')) return;
    getPodcast(initialId, library.country, 1)
      .then(({ podcast }) => setSelected(podcast))
      .catch(() => undefined);
  }, [initialId, library.country]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !auth.userId) return;
    setError(null);
    try {
      await suggestPodcast(auth.userId, selected, reason);
      setMessage(`Merci : « ${selected.title} » sera examiné avant d'être ajouté.`);
      setSelected(null);
      setReason('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const candidates = (results.data ?? []).filter((p) => !isMusicPodcast(p) && !moderation.isValidated(p.id));

  return (
    <div className="propose">
      {message && <p className="ok-text">{message}</p>}
      {selected ? (
        <form className="form" onSubmit={submit}>
          <div className="propose__selected">
            <Artwork alt={selected.title} size={56} />
            <div>
              <strong>{selected.title}</strong>
              <div className="small muted">{selected.author}</div>
            </div>
            <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Changer de podcast">
              <X size={18} />
            </button>
          </div>
          <label>
            Pourquoi ce podcast ? <span className="small muted">(prédicateur, sources, sujets…)</span>
            <textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          {error && <p className="error-text small">{error}</p>}
          <div className="row-actions">
            <button className="btn btn--primary" type="submit">
              Envoyer la proposition
            </button>
            <button className="btn btn--outline" type="button" onClick={onClose}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="search-box">
            <Search size={20} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du podcast ou du prédicateur" aria-label="Rechercher un podcast à proposer" autoFocus />
          </div>
          {results.loading && term.length >= 2 && <Spinner label="Recherche…" />}
          <ul className="import-list">
            {candidates.map((p) => (
              <li key={p.id} className="import-row">
                <Artwork alt={p.title} size={44} />
                <div className="import-row__text">
                  <strong>{p.title}</strong>
                  <span className="small muted">
                    {p.author}
                    {p.genre ? ` · ${p.genre}` : ''}
                  </span>
                </div>
                <button className="btn btn--outline btn--small" onClick={() => setSelected(p)}>
                  Choisir
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MySuggestions() {
  const auth = useAuth();
  const { data } = useAsync(() => mySuggestions(auth.userId!), [auth.userId]);
  if (!data?.length) return null;
  return (
    <>
      <h2>Vos propositions</h2>
      <ul className="import-list">
        {data.map((s) => (
          <li key={s.id} className="import-row">
            <Artwork alt={s.title} size={40} />
            <div className="import-row__text">
              <strong>{s.title}</strong>
              <span className="small muted">
                {STATUS_LABEL[s.status]} · {formatReleaseDate(s.created_at)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Modération (administrateur) ---------- */

type ModTab = 'suggestions' | 'validated' | 'add' | 'blocked';

export function ModerationPage() {
  const moderation = useModeration();
  const auth = useAuth();
  const library = useLibrary();
  const [tab, setTab] = useState<ModTab>('suggestions');
  const suggestions = useAsync(() => (moderation.isAdmin ? pendingSuggestions() : Promise.resolve([])), [moderation.isAdmin]);
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim());
  const results = useCatalogSearch(term);
  const [error, setError] = useState<string | null>(null);

  if (!auth.userId || !moderation.isAdmin) {
    return (
      <div className="page">
        <EmptyState icon={<ShieldCheck size={32} />} title="Page réservée à la modération" />
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
      moderation.reload();
      suggestions.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const approve = (s: SuggestionRow) =>
    run(async () => {
      // On complète avec les informations du catalogue (adresse du flux RSS).
      const [details] = await lookupPodcasts([s.podcast_id], library.country).catch(() => [] as Podcast[]);
      await validatePodcast(details ?? { id: s.podcast_id, title: s.title, author: s.author, artwork: '' }, s.reason ?? undefined);
      await setSuggestionStatus(s.id, 'approved');
    });

  return (
    <div className="page">
      <h1 className="page__title">Modération</h1>
      <p className="muted">Vous choisissez les podcasts islamiques proposés dans Podsal et pouvez masquer n'importe quel podcast du catalogue.</p>
      <Tabs
        tabs={[
          { id: 'suggestions', label: `Propositions (${suggestions.data?.length ?? 0})` },
          { id: 'validated', label: `Validés (${moderation.validated.length})` },
          { id: 'add', label: 'Ajouter' },
          { id: 'blocked', label: `Masqués (${moderation.blocked.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {error && <p className="error-text">{error}</p>}

      {tab === 'suggestions' &&
        (suggestions.loading ? (
          <Spinner />
        ) : suggestions.error ? (
          <ErrorState error={suggestions.error} onRetry={suggestions.reload} />
        ) : suggestions.data?.length ? (
          <ul className="import-list">
            {suggestions.data.map((s) => (
              <li key={s.id} className="import-row import-row--tall">
                <Artwork alt={s.title} size={44} />
                <div className="import-row__text">
                  <Link to={`/podcast/${s.podcast_id}`} className="link">
                    {s.title}
                  </Link>
                  <span className="small muted">
                    {s.author} · proposé par @{s.profiles?.username ?? '?'} · {formatReleaseDate(s.created_at)}
                  </span>
                  {s.reason && <span className="small">{s.reason}</span>}
                </div>
                <button className="btn btn--primary btn--small" onClick={() => approve(s)}>
                  <Check size={14} /> Valider
                </button>
                <button className="btn btn--outline btn--small" onClick={() => run(() => setSuggestionStatus(s.id, 'rejected'))}>
                  <X size={14} /> Refuser
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Aucune proposition en attente.</p>
        ))}

      {tab === 'validated' && (
        <ul className="import-list">
          {moderation.validated.map((p) => (
            <li key={p.id} className="import-row">
              <Artwork alt={p.title} size={40} />
              <div className="import-row__text">
                <Link to={`/podcast/${p.id}`} className="link">
                  {p.title}
                </Link>
                <span className="small muted">{p.author}</span>
              </div>
              <button className="btn btn--outline btn--small" onClick={() => confirm(`Retirer « ${p.title} » ?`) && run(() => unvalidatePodcast(p.id))}>
                Retirer
              </button>
            </li>
          ))}
          {!moderation.validated.length && <p className="muted">Aucun podcast validé.</p>}
        </ul>
      )}

      {tab === 'add' && (
        <>
          <div className="search-box">
            <Search size={20} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom du podcast ou du prédicateur" aria-label="Rechercher un podcast" />
          </div>
          {results.loading && term.length >= 2 && <Spinner label="Recherche…" />}
          <ul className="import-list">
            {(results.data ?? []).map((p) => (
              <li key={p.id} className="import-row">
                <Artwork alt={p.title} size={40} />
                <div className="import-row__text">
                  <Link to={`/podcast/${p.id}`} className="link">
                    {p.title}
                  </Link>
                  <span className="small muted">
                    {p.author}
                    {p.genre ? ` · ${p.genre}` : ''}
                  </span>
                </div>
                {moderation.isValidated(p.id) ? (
                  <span className="small ok-text">Validé</span>
                ) : (
                  <button className="btn btn--primary btn--small" onClick={() => run(() => validatePodcast(p))}>
                    <ShieldCheck size={14} /> Valider
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'blocked' && (
        <ul className="import-list">
          {moderation.blocked.map((b) => (
            <li key={b.podcast_id} className="import-row">
              <Artwork alt={b.title} size={40} />
              <div className="import-row__text">
                <strong>{b.title}</strong>
                <span className="small muted">masqué {formatReleaseDate(b.created_at).toLowerCase()}</span>
              </div>
              <button className="btn btn--outline btn--small" onClick={() => run(() => unblockPodcast(b.podcast_id))}>
                Rétablir
              </button>
            </li>
          ))}
          {!moderation.blocked.length && <p className="muted">Aucun podcast masqué.</p>}
        </ul>
      )}
    </div>
  );
}
