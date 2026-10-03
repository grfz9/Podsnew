import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { CUSTOM_RECITATION_BASE, getCustomRecitations, refreshReciters, type RecitationRow } from '../api/quran';
import { parseSurahList, tracksFromLines, tracksFromPattern } from '../lib/recitationInput';
import { requireBackend } from '../lib/supabase';
import { useAsync } from '../utils/hooks';
import { ErrorState, Spinner, Tabs } from './common';

const RIWAYAT = ['Hafs ʿan ʿĀsim', 'Warsh ʿan Nāfiʿ', 'Qālūn ʿan Nāfiʿ', 'Shuʿba ʿan ʿĀsim', 'Ad-Dūrī', 'As-Sūsī ʿan Abī ʿAmr', 'Khalaf ʿan Ḥamza'];
const STYLES = ['Murattal', 'Mujawwad', 'Muʿallim (pour apprendre)'];

interface Form {
  id?: number;
  reciter: string;
  title: string;
  riwaya: string;
  style: string;
  source: string;
  mode: 'pattern' | 'lines';
  pattern: string;
  surahs: string;
  lines: string;
}

const EMPTY: Form = { reciter: '', title: '', riwaya: RIWAYAT[0], style: STYLES[0], source: '', mode: 'pattern', pattern: '', surahs: '1-114', lines: '' };

function fromRow(row: RecitationRow): Form {
  const lines = Object.entries(row.tracks)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([n, url]) => `${n} ${url}`)
    .join('\n');
  return { id: row.id, reciter: row.reciter, title: row.title, riwaya: row.riwaya, style: row.style, source: row.source ?? '', mode: 'lines', pattern: '', surahs: '', lines };
}

/** Modération : récitations du Coran ajoutées à la main (enregistrements anciens, récitateurs absents de mp3quran.net). */
export function RecitationsModeration() {
  const list = useAsync(() => getCustomRecitations(), []);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  // Aperçu des fichiers à partir de la saisie.
  const preview = (() => {
    if (!form) return { tracks: {} as Record<number, string>, errors: [] as string[] };
    if (form.mode === 'pattern') {
      if (!form.pattern.trim()) return { tracks: {}, errors: [] };
      const r = tracksFromPattern(form.pattern, parseSurahList(form.surahs));
      return { tracks: r.tracks, errors: r.error ? [r.error] : [] };
    }
    return tracksFromLines(form.lines);
  })();
  const count = Object.keys(preview.tracks).length;

  const save = async () => {
    if (!form) return;
    setError(null);
    if (!form.reciter.trim()) return setError('Indiquez le nom du récitateur.');
    if (!count) return setError('Ajoutez au moins une sourate avec son lien.');
    if (preview.errors.length) return setError(preview.errors[0]);
    setBusy(true);
    const row = {
      reciter: form.reciter.trim(),
      title: form.title.trim(),
      riwaya: form.riwaya,
      style: form.style,
      source: form.source.trim() || null,
      tracks: preview.tracks,
      updated_at: new Date().toISOString(),
    };
    const client = requireBackend();
    const { error: e } = form.id ? await client.from('quran_recitations').update(row).eq('id', form.id) : await client.from('quran_recitations').insert(row);
    setBusy(false);
    if (e) return setError(e.message.includes('row-level security') ? 'Réservé à la modération.' : e.message);
    refreshReciters();
    setForm(null);
    list.reload();
  };

  const remove = async (row: RecitationRow) => {
    if (!window.confirm(`Retirer « ${row.reciter}${row.title ? ` — ${row.title}` : ''} » de Podsal ?`)) return;
    const { error: e } = await requireBackend().from('quran_recitations').delete().eq('id', row.id);
    if (e) return setError(e.message);
    refreshReciters();
    list.reload();
  };

  return (
    <section className="recitations-mod">
      <p className="small muted">
        Ajoutez des récitations absentes du catalogue (enregistrements anciens, récitateurs peu connus) en indiquant le lien du fichier audio de chaque
        sourate, par exemple depuis archive.org. Elles apparaissent dans la page Coran, section « Récitations anciennes ».
      </p>

      {!form && (
        <button className="btn btn--primary btn--small" onClick={() => setForm(EMPTY)}>
          <Plus size={14} /> Ajouter une récitation
        </button>
      )}

      {form && (
        <div className="panel recitation-form">
          <h3 className="panel__title">{form.id ? 'Modifier la récitation' : 'Nouvelle récitation'}</h3>
          <div className="recitation-form__grid">
            <label>
              Récitateur *
              <input className="input" value={form.reciter} onChange={(e) => set({ reciter: e.target.value })} placeholder="Ex. Mahmoud Khalil Al-Hussary" maxLength={120} />
            </label>
            <label>
              Précision (époque, lieu)
              <input className="input" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ex. Enregistrements du Caire, années 1960" maxLength={160} />
            </label>
            <label>
              Riwaya
              <select className="input" value={form.riwaya} onChange={(e) => set({ riwaya: e.target.value })}>
                {RIWAYAT.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Style
              <select className="input" value={form.style} onChange={(e) => set({ style: e.target.value })}>
                {STYLES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="recitation-form__wide">
              Source et crédit
              <input className="input" value={form.source} onChange={(e) => set({ source: e.target.value })} placeholder="Ex. archive.org, collection « … »" maxLength={500} />
            </label>
          </div>

          <Tabs
            tabs={[
              { id: 'pattern', label: 'Modèle d’adresse' },
              { id: 'lines', label: 'Liste de liens' },
            ]}
            value={form.mode}
            onChange={(mode) => set({ mode })}
          />
          {form.mode === 'pattern' ? (
            <div className="recitation-form__grid">
              <label className="recitation-form__wide">
                Adresse des fichiers
                <input className="input" value={form.pattern} onChange={(e) => set({ pattern: e.target.value })} placeholder="https://archive.org/download/…/{nnn}.mp3" />
                <span className="small muted">{'{nnn}'} devient 001, 002… · {'{nn}'} devient 01, 02… · {'{n}'} devient 1, 2…</span>
              </label>
              <label className="recitation-form__wide">
                Sourates disponibles
                <input className="input" value={form.surahs} onChange={(e) => set({ surahs: e.target.value })} placeholder="1-114 ou 1-10, 18, 36" />
              </label>
            </div>
          ) : (
            <label className="recitation-form__lines">
              Une ligne par sourate : numéro puis lien
              <textarea className="input" rows={6} value={form.lines} onChange={(e) => set({ lines: e.target.value })} placeholder={'18 https://…/al-kahf.mp3\n36 https://…/ya-sin.mp3'} />
            </label>
          )}

          <p className="small">
            {count ? (
              <>
                <strong>{count}</strong> sourate{count > 1 ? 's' : ''} ·{' '}
                <span className="muted">exemple : {Object.entries(preview.tracks)[0][1]}</span>
              </>
            ) : (
              <span className="muted">Aucune sourate pour l’instant.</span>
            )}
          </p>
          {preview.errors.slice(0, 3).map((m) => (
            <p key={m} className="small error-text">
              {m}
            </p>
          ))}
          {error && <p className="small error-text">{error}</p>}
          <span className="row-actions">
            <button className="btn btn--primary btn--small" onClick={() => void save()} disabled={busy}>
              {busy ? 'Enregistrement…' : form.id ? 'Enregistrer les modifications' : 'Ajouter la récitation'}
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => setForm(null)}>
              Annuler
            </button>
          </span>
        </div>
      )}

      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.data?.length ? (
        <ul className="import-list">
          {list.data.map((row) => (
            <li key={row.id} className="import-row">
              <BookOpen size={20} className="muted" />
              <div className="import-row__text">
                <Link to={`/coran/${CUSTOM_RECITATION_BASE + row.id}`} className="link-button">
                  <strong>{row.reciter}</strong>
                </Link>
                <span className="small muted">
                  {[row.title, row.riwaya, row.style, `${Object.keys(row.tracks).length} sourates`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setForm(fromRow(row))} aria-label="Modifier" title="Modifier">
                <Pencil size={16} />
              </button>
              <button className="icon-btn" onClick={() => void remove(row)} aria-label="Retirer" title="Retirer">
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !form && <p className="muted">Aucune récitation ajoutée pour l’instant.</p>
      )}
    </section>
  );
}
