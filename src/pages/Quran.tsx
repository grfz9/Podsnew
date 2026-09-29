import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { BookOpen, ChevronLeft, ChevronRight, ListPlus, Pause, Play, Repeat, Search, Star } from 'lucide-react';
import {
  ayahAt,
  BASMALA,
  getAyahTimings,
  getReciter,
  getReciters,
  getSurahText,
  surahEpisode,
  TRANSLATIONS,
  type AyahTiming,
  type Moshaf,
  type Reciter,
  type TranslationId,
} from '../api/quran';
import { getSurah } from '../data/surahs';
import { knownReciterRank, reciterMatches } from '../data/reciters';
import { Artwork, EmptyState, ErrorState, Spinner, Tabs } from '../components/common';
import { DownloadButton } from '../components/EpisodeRow';
import { usePlaylistDialog } from '../components/Playlists';
import { useLibrary } from '../store/library';
import { usePlayer, usePlayerTime } from '../store/player';
import { isQuranId } from '../lib/policy';
import { episodePath } from '../lib/paths';
import { useAsync, useDebounced } from '../utils/hooks';
import { formatTime } from '../utils/format';

/** Mushaf par défaut : Hafs murattal si disponible. */
function defaultMoshaf(reciter: Reciter): Moshaf {
  return (
    reciter.moshaf.find((m) => m.riwaya.startsWith('Hafs') && m.style === 'Murattal') ??
    reciter.moshaf.find((m) => m.riwaya.startsWith('Hafs')) ??
    reciter.moshaf[0]
  );
}

function useFavorites() {
  const library = useLibrary();
  const favorites = library.settings.quran.favorites;
  const toggle = (id: number) =>
    library.setSettings({
      quran: { ...library.settings.quran, favorites: favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id] },
    });
  return { favorites, toggle, isFavorite: (id: number) => favorites.includes(id) };
}

function FavoriteButton({ reciterId }: { reciterId: number }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(reciterId);
  return (
    <button
      className={`icon-btn ${fav ? 'icon-btn--active' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        toggle(reciterId);
      }}
      aria-label={fav ? 'Retirer des récitateurs favoris' : 'Ajouter aux récitateurs favoris'}
      title={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Star size={18} fill={fav ? 'currentColor' : 'none'} />
    </button>
  );
}

/* ---------- Accueil du Coran : récitateurs ---------- */

export function QuranHome() {
  const { data, error, loading, reload } = useAsync(() => getReciters(), []);
  const library = useLibrary();
  const { favorites } = useFavorites();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim().toLowerCase(), 150);
  const [riwaya, setRiwaya] = useState('all');

  const riwayat = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of data ?? []) for (const m of new Set(r.moshaf.map((x) => x.riwaya))) count.set(m, (count.get(m) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [data]);

  const list = (data ?? []).filter((r) => reciterMatches(r.name, q) && (riwaya === 'all' || r.moshaf.some((m) => m.riwaya === riwaya)));
  const favs = (data ?? []).filter((r) => favorites.includes(r.id));
  // Récitateurs connus, dans l'ordre de la liste (src/data/reciters.ts).
  const known = useMemo(
    () =>
      (data ?? [])
        .map((r) => ({ r, rank: knownReciterRank(r.name) }))
        .filter((x) => x.rank >= 0)
        .sort((a, b) => a.rank - b.rank)
        .map((x) => x.r),
    [data],
  );
  const recent = library.history.filter((e) => isQuranId(e.podcastId)).slice(0, 4);

  return (
    <div className="page">
      <h1 className="page__title">Coran</h1>

      {recent.length > 0 && (
        <section className="section">
          <h2 className="section-title">Reprendre</h2>
          <div className="surah-chips">
            {recent.map((e) => (
              <Link key={e.id} to={episodePath(e)} className="surah-chip">
                <strong>{e.title}</strong>
                <span className="small muted">{e.podcastTitle}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {favs.length > 0 && (
        <section className="section">
          <h2 className="section-title">Récitateurs favoris</h2>
          <div className="reciter-list">
            {favs.map((r) => (
              <ReciterRow key={r.id} reciter={r} />
            ))}
          </div>
        </section>
      )}

      {known.length > 0 && !q && riwaya === 'all' && (
        <section className="section">
          <h2 className="section-title">Récitateurs connus</h2>
          <div className="reciter-grid">
            {known.map((r) => (
              <ReciterRow key={r.id} reciter={r} />
            ))}
          </div>
        </section>
      )}

      <h2 className="section-title">Tous les récitateurs{data ? ` (${data.length})` : ''}</h2>
      <div className="search-box">
        <Search size={20} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un récitateur" aria-label="Rechercher un récitateur" />
      </div>
      {riwayat.length > 1 && (
        <Tabs
          tabs={[{ id: 'all', label: 'Toutes les riwayat' }, ...riwayat.slice(0, 8).map((r) => ({ id: r, label: r }))]}
          value={riwaya}
          onChange={setRiwaya}
        />
      )}

      {loading && !data ? (
        <Spinner label="Chargement des récitateurs…" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : list.length ? (
        <div className="reciter-list">
          {list.map((r) => (
            <ReciterRow key={r.id} reciter={r} riwaya={riwaya === 'all' ? undefined : riwaya} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<BookOpen size={32} />} title="Aucun récitateur ne correspond" />
      )}
      <p className="small muted">Récitations : mp3quran.net · Texte : édition Uthmani (Hafs) · Traductions : QuranEnc.com.</p>
    </div>
  );
}

function ReciterRow({ reciter, riwaya }: { reciter: Reciter; riwaya?: string }) {
  const moshaf = riwaya ? reciter.moshaf.find((m) => m.riwaya === riwaya) : undefined;
  const riwayat = [...new Set(reciter.moshaf.map((m) => m.riwaya))];
  return (
    <Link to={`/coran/${reciter.id}${moshaf ? `?m=${moshaf.id}` : ''}`} className="reciter-row">
      <Artwork alt={reciter.name} size={48} kind="quran" />
      <span className="reciter-row__text">
        <strong>{reciter.name}</strong>
        <span className="small muted">{riwayat.join(' · ')}</span>
      </span>
      <FavoriteButton reciterId={reciter.id} />
    </Link>
  );
}

/* ---------- Page d'un récitateur : sourates ---------- */

export function ReciterPage() {
  const { reciterId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: reciter, error, loading, reload } = useAsync(() => getReciter(Number(reciterId)), [reciterId]);
  const player = usePlayer();
  const [query, setQuery] = useState('');

  if (loading && !reciter) return <div className="page"><Spinner /></div>;
  if (!reciter) return <div className="page">{error && <ErrorState error={error} onRetry={reload} />}</div>;

  const moshaf = reciter.moshaf.find((m) => String(m.id) === params.get('m')) ?? defaultMoshaf(reciter);
  const q = query.trim().toLowerCase();
  const surahs = moshaf.surahs
    .map((n) => getSurah(n)!)
    .filter((s) => !q || String(s.number) === q || s.name.toLowerCase().includes(q) || s.meaning.toLowerCase().includes(q) || s.arabic.includes(query.trim()));
  const episodes = moshaf.surahs.map((n) => surahEpisode(reciter, moshaf, n));

  return (
    <div className="page">
      <header className="episode-hero">
        <Artwork alt={reciter.name} className="episode-hero__art" kind="quran" />
        <div className="episode-hero__info">
          <Link to="/coran" className="episode-hero__podcast">
            Coran
          </Link>
          <h1>{reciter.name}</h1>
          <p className="small muted">
            {moshaf.riwaya} · {moshaf.style} · {moshaf.surahs.length} sourates
          </p>
          <div className="row-actions">
            <button className="btn btn--primary" onClick={() => player.playAll(episodes)}>
              <Play size={16} fill="currentColor" /> Tout écouter
            </button>
            <FavoriteButton reciterId={reciter.id} />
          </div>
        </div>
      </header>

      {reciter.moshaf.length > 1 && (
        <label className="setting moshaf-select">
          <span>Récitation</span>
          <select value={moshaf.id} onChange={(e) => setParams({ m: e.target.value }, { replace: true })}>
            {reciter.moshaf.map((m) => (
              <option key={m.id} value={m.id}>
                {m.riwaya} — {m.style} ({m.surahs.length} sourates)
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="search-box search-box--small surah-search">
        <Search size={16} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Numéro ou nom de sourate" aria-label="Rechercher une sourate" />
      </div>

      <ol className="surah-list">
        {surahs.map((s) => (
          <SurahRow key={s.number} reciter={reciter} moshaf={moshaf} surah={s.number} />
        ))}
      </ol>
    </div>
  );
}

function SurahRow({ reciter, moshaf, surah }: { reciter: Reciter; moshaf: Moshaf; surah: number }) {
  const player = usePlayer();
  const openPlaylist = usePlaylistDialog();
  const s = getSurah(surah)!;
  const episode = surahEpisode(reciter, moshaf, surah);
  const playing = player.current?.id === episode.id && player.isPlaying;
  return (
    <li className={`surah-row ${player.current?.id === episode.id ? 'surah-row--current' : ''}`}>
      <span className="surah-row__number">{s.number}</span>
      <Link to={`/coran/${reciter.id}/${s.number}?m=${moshaf.id}`} className="surah-row__text">
        <strong>{s.name}</strong>
        <span className="small muted">
          {s.meaning} · {s.ayahs} versets · {s.revelation}
        </span>
      </Link>
      <span className="surah-row__arabic" lang="ar" dir="rtl">
        {s.arabic}
      </span>
      <button className="play-btn play-btn--small" onClick={() => (playing ? player.pause() : player.play(episode))} aria-label={playing ? 'Pause' : `Écouter ${s.name}`}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <DownloadButton episode={episode} />
      <button className="icon-btn" onClick={() => openPlaylist(episode)} aria-label="Ajouter à une playlist" title="Ajouter à une playlist">
        <ListPlus size={18} />
      </button>
    </li>
  );
}

/* ---------- Page d'une sourate : texte, traduction, répétition ---------- */

const REPEAT_CHOICES = [
  { value: 1, label: 'Une fois' },
  { value: 2, label: '2 fois' },
  { value: 3, label: '3 fois' },
  { value: 5, label: '5 fois' },
  { value: 10, label: '10 fois' },
  { value: Infinity, label: 'En boucle' },
];

export function SurahPage() {
  const { reciterId = '', surah: surahParam = '1' } = useParams();
  const [params] = useSearchParams();
  const surahNumber = Math.min(114, Math.max(1, Number(surahParam) || 1));
  const s = getSurah(surahNumber)!;
  const library = useLibrary();
  const player = usePlayer();
  const { time } = usePlayerTime();
  const openPlaylist = usePlaylistDialog();
  const { data: reciter, error, loading, reload } = useAsync(() => getReciter(Number(reciterId)), [reciterId]);
  const moshaf = reciter ? (reciter.moshaf.find((m) => String(m.id) === params.get('m')) ?? defaultMoshaf(reciter)) : undefined;
  const episode = reciter && moshaf ? surahEpisode(reciter, moshaf, surahNumber) : undefined;

  const settings = library.settings.quran;
  const translation: TranslationId | null = settings.translation === 'none' ? null : settings.translation;
  const text = useAsync(() => getSurahText(surahNumber, translation), [surahNumber, translation]);
  const timings = useAsync(() => (moshaf ? getAyahTimings(surahNumber, moshaf.id) : Promise.resolve(null)), [surahNumber, moshaf?.id]);

  const isCurrent = !!episode && player.current?.id === episode.id;
  const playing = isCurrent && player.isPlaying;
  const currentAyah = isCurrent && timings.data ? ayahAt(timings.data, time) : null;

  const [times, setTimes] = useState(1);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(s.ayahs);
  useEffect(() => {
    setFrom(1);
    setTo(s.ayahs);
  }, [s.ayahs]);

  const activeRef = useRef<HTMLLIElement>(null);
  const [follow, setFollow] = useState(true);
  useEffect(() => {
    if (follow && currentAyah) activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [currentAyah, follow]);

  const setQuran = (patch: Partial<typeof settings>) => library.setSettings({ quran: { ...settings, ...patch } });

  if (loading && !reciter) return <div className="page"><Spinner /></div>;
  if (!reciter || !moshaf || !episode) return <div className="page">{error && <ErrorState error={error} onRetry={reload} />}</div>;

  const available = moshaf.surahs.includes(surahNumber);
  const prev = moshaf.surahs.filter((n) => n < surahNumber).pop();
  const next = moshaf.surahs.find((n) => n > surahNumber);
  const rangeTimings = timings.data?.filter((t) => t.ayah >= from && t.ayah <= to) ?? [];

  const startRepeat = () => {
    if (rangeTimings.length && (from > 1 || to < s.ayahs)) {
      const start = rangeTimings[0].start;
      const end = rangeTimings[rangeTimings.length - 1].end;
      player.play(episode, start);
      player.setRepeat({ episodeId: episode.id, remaining: times, start, end });
    } else {
      player.play(episode, 0);
      player.setRepeat(times > 1 ? { episodeId: episode.id, remaining: times, start: 0 } : null);
    }
  };

  const seekToAyah = (t: AyahTiming) => {
    if (isCurrent) player.seek(t.start);
    else player.play(episode, t.start);
  };

  const repeatInfo = player.repeat && player.repeat.episodeId === episode.id ? player.repeat : null;

  return (
    <div className="page surah-page">
      <nav className="surah-nav">
        <Link to={`/coran/${reciter.id}?m=${moshaf.id}`} className="link-button muted">
          {reciter.name}
        </Link>
        <span className="spacer" />
        {prev && (
          <Link to={`/coran/${reciter.id}/${prev}?m=${moshaf.id}`} className="btn btn--ghost btn--small">
            <ChevronLeft size={14} /> Sourate {prev}
          </Link>
        )}
        {next && (
          <Link to={`/coran/${reciter.id}/${next}?m=${moshaf.id}`} className="btn btn--ghost btn--small">
            Sourate {next} <ChevronRight size={14} />
          </Link>
        )}
      </nav>

      <header className="surah-head">
        <p className="surah-head__arabic" lang="ar" dir="rtl">
          سورة {s.arabic}
        </p>
        <h1>
          {s.number}. {s.name}
        </h1>
        <p className="muted">
          {s.meaning} · {s.ayahs} versets · {s.revelation}
        </p>
        <p className="small muted">
          {reciter.name} · {moshaf.riwaya} · {moshaf.style}
        </p>
        {available ? (
          <div className="row-actions surah-head__actions">
            <button className="play-btn play-btn--big" onClick={() => (playing ? player.pause() : player.play(episode))} aria-label={playing ? 'Pause' : 'Écouter la sourate'}>
              {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <DownloadButton episode={episode} />
            <button className="icon-btn" onClick={() => openPlaylist(episode)} aria-label="Ajouter à une playlist" title="Ajouter à une playlist">
              <ListPlus size={20} />
            </button>
          </div>
        ) : (
          <p className="error-text small">Cette sourate n'est pas disponible dans cette récitation.</p>
        )}
      </header>

      {available && (
        <section className="panel repeat-panel">
          <h2 className="panel__title">
            <Repeat size={18} /> Répéter pour mémoriser
          </h2>
          <div className="repeat-form">
            <label>
              Répétitions
              <select value={times} onChange={(e) => setTimes(Number(e.target.value))}>
                {REPEAT_CHOICES.map((c) => (
                  <option key={c.label} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {timings.data ? (
              <>
                <label>
                  Du verset
                  <input type="number" min={1} max={to} value={from} onChange={(e) => setFrom(Math.min(to, Math.max(1, Number(e.target.value) || 1)))} />
                </label>
                <label>
                  au verset
                  <input type="number" min={from} max={s.ayahs} value={to} onChange={(e) => setTo(Math.max(from, Math.min(s.ayahs, Number(e.target.value) || s.ayahs)))} />
                </label>
              </>
            ) : (
              <p className="small muted repeat-form__note">
                {timings.loading ? 'Recherche du minutage des versets…' : 'Pour cette récitation, seule la sourate entière peut être répétée.'}
              </p>
            )}
            <button className="btn btn--primary" onClick={startRepeat}>
              <Repeat size={16} /> Lancer
            </button>
          </div>
          {repeatInfo && (
            <p className="small ok-text">
              Répétition en cours
              {repeatInfo.end !== undefined ? ` (${formatTime(repeatInfo.start)} – ${formatTime(repeatInfo.end)})` : ''} ·{' '}
              {repeatInfo.remaining === Infinity ? 'en boucle' : `${repeatInfo.remaining} lecture${repeatInfo.remaining > 1 ? 's' : ''} restante${repeatInfo.remaining > 1 ? 's' : ''}`}{' '}
              <button className="link-button link" onClick={() => player.setRepeat(null)}>
                Arrêter la répétition
              </button>
            </p>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel__tools">
          <label className="checkbox small">
            <input type="checkbox" checked={settings.showArabic} onChange={(e) => setQuran({ showArabic: e.target.checked })} /> Texte arabe
          </label>
          <label className="small">
            Traduction{' '}
            <select value={settings.translation} onChange={(e) => setQuran({ translation: e.target.value as typeof settings.translation })}>
              {TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
              <option value="none">Aucune</option>
            </select>
          </label>
          {timings.data && isCurrent && (
            <label className="checkbox small">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Suivre la récitation
            </label>
          )}
        </div>
        {translation && <p className="small muted">{TRANSLATIONS.find((t) => t.id === translation)?.source} La traduction rend le sens, elle n'est pas le Coran.</p>}
        {moshaf.riwaya && !moshaf.riwaya.startsWith('Hafs') && settings.showArabic && (
          <p className="small muted">Le texte affiché suit la lecture Hafs ; la récitation écoutée est en {moshaf.riwaya}.</p>
        )}

        {text.loading && !text.data ? (
          <Spinner label="Chargement du texte…" />
        ) : text.error ? (
          <ErrorState error={text.error} onRetry={text.reload} />
        ) : (
          <>
            {surahNumber !== 1 && surahNumber !== 9 && settings.showArabic && (
              <p className="basmala" lang="ar" dir="rtl">
                {BASMALA}
              </p>
            )}
            <ol className="ayahs">
              {text.data?.map((a) => {
                const t = timings.data?.find((x) => x.ayah === a.number);
                const active = currentAyah === a.number;
                return (
                  <li key={a.number} ref={active ? activeRef : undefined} className={`ayah ${active ? 'ayah--active' : ''}`}>
                    <button className="ayah__number" onClick={() => t && seekToAyah(t)} disabled={!t} aria-label={`Verset ${a.number}${t ? ', écouter' : ''}`}>
                      {a.number}
                    </button>
                    <div className="ayah__body">
                      {settings.showArabic && (
                        <p className="ayah__arabic" lang="ar" dir="rtl">
                          {a.arabic}
                        </p>
                      )}
                      {a.translation && <p className="ayah__translation">{a.translation}</p>}
                      {a.footnotes && <p className="ayah__footnotes small muted">{a.footnotes}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
