import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Copy, ExternalLink, Mic, Pencil, Plus, Trash, Upload } from 'lucide-react';
import { GENRES } from '../api/genres';
import { rssUrl, toNativeId } from '../api/native';
import {
  createPodcast,
  deleteEpisode,
  deletePodcast,
  getCreatorStats,
  getMyPodcast,
  listEpisodes,
  myPodcasts,
  publishEpisode,
  updatePodcast,
  uploadCover,
  type PodcastInput,
} from '../api/studio';
import { BarChart } from '../components/BarChart';
import { Artwork, EmptyState, ErrorState, Spinner } from '../components/common';
import { useAuth } from '../store/auth';
import { formatDuration, formatReleaseDate } from '../utils/format';
import { useAsync } from '../utils/hooks';
import { formatListening } from './Stats';
import { dayKey } from '../lib/stats';

function RequireAccount({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.enabled || !auth.userId) {
    return (
      <div className="page">
        <h1 className="page__title">Studio</h1>
        <EmptyState icon={<Mic size={32} />} title="Publiez votre podcast sur Podsal">
          {auth.enabled ? (
            <>
              Hébergez vos épisodes, obtenez un flux RSS à soumettre aux autres plateformes et suivez vos écoutes.{' '}
              <Link to="/account" className="link">
                Connectez-vous pour commencer
              </Link>
              .
            </>
          ) : (
            "Le studio nécessite l'activation des comptes (voir le README du projet)."
          )}
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

/* ---------- Formulaire du podcast ---------- */

const EMPTY: PodcastInput = { title: '', description: '', author: '', category_id: 1324, language: 'fr', explicit: false, cover_url: null, contact_email: null };

function PodcastForm({ initial, onSaved }: { initial?: PodcastInput & { id?: string }; onSaved: (id: string) => void }) {
  const auth = useAuth();
  const [form, setForm] = useState<PodcastInput>(initial ?? { ...EMPTY, author: auth.profile?.display_name ?? '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PodcastInput>(key: K, value: PodcastInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cover_url = coverFile ? await uploadCover(auth.userId!, coverFile) : form.cover_url;
      const data = { ...form, cover_url, contact_email: form.contact_email?.trim() || null };
      if (initial?.id) {
        await updatePodcast(initial.id, data);
        onSaved(initial.id);
      } else {
        const created = await createPodcast(auth.userId!, data);
        onSaved(created.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form studio-form" onSubmit={submit}>
      <label>
        Titre
        <input required maxLength={120} value={form.title} onChange={(e) => set('title', e.target.value)} />
      </label>
      <label>
        Auteur ou animateur
        <input required maxLength={120} value={form.author} onChange={(e) => set('author', e.target.value)} />
      </label>
      <label>
        Description
        <textarea rows={4} maxLength={4000} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </label>
      <div className="form__row">
        <label>
          Catégorie
          <select value={form.category_id} onChange={(e) => set('category_id', Number(e.target.value))}>
            {GENRES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Langue
          <select value={form.language} onChange={(e) => set('language', e.target.value)}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="ar">Arabe</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="pt">Portugais</option>
          </select>
        </label>
      </div>
      <label>
        Pochette <span className="small muted">(utilisée seulement dans le flux RSS pour les autres plateformes ; non affichée dans Podsal ; sans êtres vivants ; 2 Mo max)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
      </label>
      <label>
        E-mail de contact <span className="small muted">(facultatif, publié dans le flux RSS : Apple Podcasts l'exige pour vérifier la propriété)</span>
        <input type="email" value={form.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value)} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={form.explicit} onChange={(e) => set('explicit', e.target.checked)} /> Contenu explicite
      </label>
      <p className="small muted">
        Pas de musique ni de contenu explicite. Pour un podcast de science religieuse, publiez-le puis proposez-le à la vérification depuis la page
        « Podcasts islamiques » : il y sera ajouté après validation.
      </p>
      {error && <p className="error-text small">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? 'Enregistrement…' : initial?.id ? 'Enregistrer' : 'Créer le podcast'}
      </button>
    </form>
  );
}

/* ---------- Liste des podcasts du créateur ---------- */

export function StudioPage() {
  return (
    <RequireAccount>
      <StudioHome />
    </RequireAccount>
  );
}

function StudioHome() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useAsync(() => myPodcasts(auth.userId!), [auth.userId]);

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Studio</h1>
        {!creating && (
          <button className="btn btn--primary btn--small" onClick={() => setCreating(true)}>
            <Plus size={14} /> Nouveau podcast
          </button>
        )}
      </div>
      <p className="muted">Publiez vos épisodes sur Podsal, obtenez un flux RSS pour les autres plateformes et suivez vos écoutes.</p>
      <p className="scholar-notice">
        Podsal est une appli 100 % islamique : votre podcast (cours, rappels, khoutbas…) apparaît dans Podsal une fois vérifié et validé par la modération.
      </p>

      {creating && (
        <section className="panel">
          <h2 className="panel__title">Nouveau podcast</h2>
          <PodcastForm onSaved={(id) => navigate(`/studio/${id}`)} />
        </section>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data?.length ? (
        <div className="studio-list">
          {data.map((p) => (
            <Link key={p.id} to={`/studio/${p.id}`} className="studio-item">
              <Artwork alt={p.title} size={72} genreIds={[String(p.category_id)]} />
              <div>
                <strong>{p.title}</strong>
                <div className="small muted">
                  {GENRES.find((g) => g.id === p.category_id)?.name} · créé {formatReleaseDate(p.created_at).toLowerCase()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        !creating && <p className="muted">Vous n'avez pas encore de podcast.</p>
      )}
    </div>
  );
}

/* ---------- Gestion d'un podcast ---------- */

export function StudioPodcastPage() {
  return (
    <RequireAccount>
      <StudioPodcast />
    </RequireAccount>
  );
}

function EpisodeUpload({ podcastId, onDone }: { podcastId: string; onDone: () => void }) {
  const auth = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      await publishEpisode(auth.userId!, podcastId, file, { title, description, published_at: publishAt ? new Date(publishAt).toISOString() : undefined }, setProgress);
      setFile(null);
      setTitle('');
      setDescription('');
      setPublishAt('');
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return (
    <form className="form studio-form" onSubmit={submit}>
      <label>
        Fichier audio <span className="small muted">(MP3 conseillé, 200 Mo max)</span>
        <input type="file" accept="audio/*" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label>
        Titre de l'épisode
        <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <textarea rows={4} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label>
        Date de publication <span className="small muted">(vide = maintenant)</span>
        <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
      </label>
      {error && <p className="error-text small">{error}</p>}
      {progress !== null && (
        <div className="upload-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress * 100}%` }} />
          <em>{Math.round(progress * 100)} %</em>
        </div>
      )}
      <button className="btn btn--primary" type="submit" disabled={!file || progress !== null}>
        <Upload size={16} /> Publier l'épisode
      </button>
    </form>
  );
}

function StudioPodcast() {
  const auth = useAuth();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const podcast = useAsync(() => getMyPodcast(id), [id]);
  const episodes = useAsync(() => listEpisodes(id), [id]);
  const stats = useAsync(() => getCreatorStats(id), [id]);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (podcast.loading && !podcast.data) return <div className="page"><Spinner /></div>;
  if (podcast.error || !podcast.data) return <div className="page"><ErrorState error={podcast.error ?? new Error('Podcast introuvable')} /></div>;
  const p = podcast.data;
  if (p.owner_id !== auth.userId) {
    return (
      <div className="page">
        <EmptyState icon={<Mic size={32} />} title="Ce podcast ne vous appartient pas">
          <Link to={`/podcast/${toNativeId(p.id)}`} className="link">
            Voir sa page publique
          </Link>
        </EmptyState>
      </div>
    );
  }
  const feed = rssUrl(p.id);
  const byEpisode = new Map((stats.data?.episodes ?? []).map((e) => [e.id, e]));
  const totalPlays = (stats.data?.episodes ?? []).reduce((s, e) => s + e.plays, 0);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    const key = dayKey(d);
    return {
      label: String(d.getDate()),
      name: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
      value: stats.data?.daily.find((x) => x.day === key)?.plays ?? 0,
    };
  });

  return (
    <div className="page">
      <header className="episode-hero">
        <Artwork alt={p.title} className="episode-hero__art" genreIds={[String(p.category_id)]} />
        <div className="episode-hero__info">
          <Link to="/studio" className="episode-hero__podcast">
            Studio
          </Link>
          <h1>{p.title}</h1>
          <p className="small muted">
            {p.author} · {GENRES.find((g) => g.id === p.category_id)?.name}
          </p>
          <div className="row-actions">
            <Link to={`/podcast/${toNativeId(p.id)}`} className="btn btn--outline btn--small">
              <ExternalLink size={14} /> Page publique
            </Link>
            <button className="btn btn--outline btn--small" onClick={() => setEditing((v) => !v)}>
              <Pencil size={14} /> Modifier
            </button>
          </div>
        </div>
      </header>

      {editing && (
        <section className="panel">
          <PodcastForm
            initial={{ ...p, contact_email: p.contact_email }}
            onSaved={() => {
              setEditing(false);
              podcast.reload();
            }}
          />
          <button
            className="btn btn--danger btn--small"
            onClick={async () => {
              if (!confirm(`Supprimer définitivement « ${p.title} » et tous ses épisodes ?`)) return;
              await deletePodcast(p.id);
              navigate('/studio');
            }}
          >
            <Trash size={14} /> Supprimer le podcast
          </button>
        </section>
      )}

      {feed && (
        <section className="panel">
          <h2 className="panel__title">Flux RSS</h2>
          <p className="small muted">Soumettez cette adresse à Apple Podcasts, Spotify, Deezer ou Amazon Music pour y diffuser votre podcast.</p>
          <div className="copy-row">
            <input className="copy-field" readOnly value={feed} onFocus={(e) => e.target.select()} aria-label="Adresse du flux RSS" />
            <button
              className="btn btn--outline btn--small"
              onClick={() => navigator.clipboard.writeText(feed).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })}
            >
              <Copy size={14} /> {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </section>
      )}

      <section className="panel">
        <h2 className="panel__title">Écoutes</h2>
        <p className="small muted">Une écoute est comptée au-delà de 30 secondes, une seule fois par appareil et par épisode.</p>
        <div className="tiles">
          <div className="tile">
            <span className="tile__label">Écoutes au total</span>
            <span className="tile__value">{totalPlays.toLocaleString('fr-FR')}</span>
          </div>
          <div className="tile">
            <span className="tile__label">Épisodes publiés</span>
            <span className="tile__value">{episodes.data?.length ?? 0}</span>
          </div>
        </div>
        <BarChart title="Écoutes par jour (30 derniers jours)" bars={days} format={(v) => Math.round(v).toLocaleString('fr-FR')} labelEvery={5} height={140} />
      </section>

      <section className="panel">
        <h2 className="panel__title">Publier un épisode</h2>
        <EpisodeUpload
          podcastId={p.id}
          onDone={() => {
            episodes.reload();
            stats.reload();
          }}
        />
      </section>

      <section>
        <h2 className="section-title">Épisodes</h2>
        {episodes.data?.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Épisode</th>
                <th scope="col">Publication</th>
                <th scope="col">Écoutes</th>
                <th scope="col">Auditeurs</th>
                <th scope="col">Écoute moyenne</th>
                <th scope="col" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {episodes.data.map((e) => {
                const s = byEpisode.get(e.id);
                const scheduled = new Date(e.published_at) > new Date();
                return (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.title}</strong>
                      <div className="small muted">{formatDuration(e.duration)}</div>
                    </td>
                    <td>{scheduled ? `Programmé : ${new Date(e.published_at).toLocaleString('fr-FR')}` : formatReleaseDate(e.published_at)}</td>
                    <td>{s?.plays ?? 0}</td>
                    <td>{s?.listeners ?? 0}</td>
                    <td>
                      {s?.avg_seconds ? formatListening(s.avg_seconds) : '—'}
                      {s?.avg_seconds && e.duration ? <span className="small muted"> ({Math.round((s.avg_seconds / e.duration) * 100)} %)</span> : null}
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={`Supprimer ${e.title}`}
                        onClick={async () => {
                          if (!confirm(`Supprimer l'épisode « ${e.title} » ?`)) return;
                          await deleteEpisode(e);
                          episodes.reload();
                          stats.reload();
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">Aucun épisode publié.</p>
        )}
      </section>
    </div>
  );
}
