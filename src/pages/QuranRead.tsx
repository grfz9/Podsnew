import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { Bookmark, BookmarkCheck, BookOpenText, ChevronLeft, ChevronRight, Brain, Copy, Eye, EyeOff, Headphones, Image as ImageIcon, Info, Minus, Pause, Play, Repeat, Plus, Search, X } from 'lucide-react';
import { ayahAt, BASMALA, getAyahTimings, getSurahText, SCHOLAR_NOTICE, surahEpisode, TRANSLATIONS, type AyahTiming, type TranslationId } from '../api/quran';
import { JUZ_STARTS, PAGE_STARTS } from '../data/mushaf';
import { juzOf, pageOf } from '../lib/khatma';
import { usePlayer, usePlayerTime } from '../store/player';
import { DailyVerse } from '../components/DailyVerse';
import { useQuranReciter } from '../components/useQuranReciter';
import { QuranTabs } from '../components/QuranTabs';
import { ReadingPlanCard } from '../components/ReadingPlan';
import { VerseShareDialog, type SharedVerse } from '../components/VerseShare';
import { ErrorState, Spinner, Tabs } from '../components/common';
import { normalizeName } from '../data/reciters';
import { getSurah, SURAHS } from '../data/surahs';
import { useLibrary, type QuranPlace } from '../store/library';
import { useAsync } from '../utils/hooks';

type Mode = 'both' | 'arabic' | 'translation';
const MODES: { id: Mode; label: string }[] = [
  { id: 'both', label: 'Arabe et traduction' },
  { id: 'arabic', label: 'Arabe (mushaf)' },
  { id: 'translation', label: 'Traduction' },
];
const SIZES = [22, 26, 30, 34, 40, 46];
const DEFAULT_SIZE = 30;

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arabicNumber = (n: number) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

function useQuranSettings() {
  const library = useLibrary();
  const quran = library.settings.quran;
  const set = (patch: Partial<typeof quran>) => library.setSettings({ quran: { ...library.settings.quran, ...patch } });
  return { quran, set };
}

function placeLabel(p: QuranPlace) {
  const s = getSurah(p.surah);
  return `${s?.name ?? `Sourate ${p.surah}`} · verset ${p.ayah}`;
}

/* ---------- Liste des sourates ---------- */

export function QuranReadHome() {
  const { quran, set } = useQuranSettings();
  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState<'surahs' | 'juz'>('surahs');
  const q = normalizeName(query.trim());
  const list = SURAHS.filter(
    (s) => !q || String(s.number) === q || normalizeName(s.name).includes(q) || normalizeName(s.meaning).includes(q) || s.arabic.includes(query.trim()),
  );
  const bookmarks = [...(quran.bookmarks ?? [])].sort((a, b) => b.at - a.at);
  const last = quran.lastRead;

  return (
    <div className="page quran-read">
      <div className="page__head-row">
        <h1 className="page__title">Coran</h1>
        <QuranTabs />
      </div>
      <Link to="/lire/recherche" className="read-search-link">
        <Search size={18} /> Rechercher un mot dans le Coran
      </Link>
      <DailyVerse />
      <ReadingPlanCard />

      {(last || bookmarks.length > 0) && (
        <div className="read-resume">
          {last && (
            <Link to={`/lire/${last.surah}?v=${last.ayah}`} className="read-resume__card">
              <BookOpenText size={22} />
              <span>
                <span className="small muted">Reprendre la lecture</span>
                <strong>{placeLabel(last)}</strong>
              </span>
              <ChevronRight size={18} />
            </Link>
          )}
          {bookmarks.length > 0 && (
            <section className="read-bookmarks" aria-label="Marque-pages">
              <h2 className="section-title">Marque-pages</h2>
              <ul>
                {bookmarks.map((b) => (
                  <li key={`${b.surah}:${b.ayah}`}>
                    <Link to={`/lire/${b.surah}?v=${b.ayah}`}>
                      <Bookmark size={15} /> {placeLabel(b)}
                    </Link>
                    <button
                      className="icon-btn"
                      aria-label="Retirer le marque-page"
                      title="Retirer"
                      onClick={() => set({ bookmarks: (quran.bookmarks ?? []).filter((x) => x.surah !== b.surah || x.ayah !== b.ayah) })}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <Tabs
        tabs={[
          { id: 'surahs', label: 'Sourates' },
          { id: 'juz', label: 'Juz' },
        ]}
        value={browse}
        onChange={setBrowse}
      />
      {browse === 'juz' ? (
        <div className="read-grid">
          {JUZ_STARTS.map(([su, ay], i) => (
            <Link key={i} to={`/lire/${su}?v=${ay}`} className="read-card">
              <span className="read-card__number">{i + 1}</span>
              <span className="read-card__text">
                <strong>Juz {i + 1}</strong>
                <span className="small muted">
                  Commence à {getSurah(su)?.name} {ay} · page {pageOf({ surah: su, ayah: ay })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
      <>
      <div className="search-box">
        <Search size={20} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, numéro ou sens d’une sourate" aria-label="Rechercher une sourate" />
      </div>
      <div className="read-grid">
        {list.map((s) => (
          <Link key={s.number} to={`/lire/${s.number}`} className="read-card">
            <span className="read-card__number">{s.number}</span>
            <span className="read-card__text">
              <strong>{s.name}</strong>
              <span className="small muted">
                {s.meaning} · {s.ayahs} versets
              </span>
            </span>
            <span className="read-card__arabic" lang="ar" dir="rtl">
              {s.arabic}
            </span>
          </Link>
        ))}
      </div>
      </>
      )}
      <p className="small muted">Texte : édition Uthmani (Hafs) · Traductions : QuranEnc.com.</p>
    </div>
  );
}

/* ---------- Écouter la sourate : dernier récitateur écouté, sinon un récitateur connu ---------- */

function ListenLink({ surah, from, to, label = 'Écouter', icon = <Headphones size={15} /> }: { surah: number; from?: number; to?: number; label?: string; icon?: React.ReactNode }) {
  const choice = useQuranReciter(surah);
  if (!choice) return null;
  const query = [`m=${choice.moshaf.id}`, from ? `de=${from}&a=${to ?? from}` : ''].filter(Boolean).join('&');
  return (
    <Link to={`/coran/${choice.reciter.id}/${surah}?${query}`} className="btn btn--outline btn--small">
      {icon} {label}
    </Link>
  );
}

/** Mémorisation : texte arabe masqué (flou), avec le premier mot en indice si demandé. */
function HiddenArabic({ text, hint }: { text: string; hint: boolean }) {
  const space = text.indexOf(' ');
  const first = hint && space > 0 ? text.slice(0, space) : '';
  const rest = first ? text.slice(space) : text;
  return (
    <>
      {first}
      <span className="memo-hidden" aria-label="Verset masqué, touchez pour le révéler">
        {rest}
      </span>
    </>
  );
}

/**
 * Écouter en lisant (comme quran.com) : le verset récité est surligné et suivi à l'écran,
 * sauf si l'on vient de faire défiler soi-même. Sans rendu : agit directement sur les versets affichés.
 */
function FollowAlong({ timings, active, verses }: { timings: AyahTiming[] | null; active: boolean; verses: Map<number, HTMLElement> }) {
  const { time } = usePlayerTime();
  const ayah = active && timings ? ayahAt(timings, time) : null;
  const userScroll = useRef(0);
  useEffect(() => {
    const mark = () => (userScroll.current = Date.now());
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
    };
  }, []);
  useEffect(() => {
    verses.forEach((el, n) => el.classList.toggle('is-playing', n === ayah));
    const el = ayah ? verses.get(ayah) : null;
    if (el && Date.now() - userScroll.current > 4000) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [ayah, verses]);
  return null;
}

/* ---------- Lecture d'une sourate ---------- */

export function QuranReadSurah() {
  const { surah: param = '1' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const number = Math.min(114, Math.max(1, Number(param) || 1));
  const s = getSurah(number)!;
  const { quran, set } = useQuranSettings();
  const mode: Mode = quran.readerMode ?? 'both';
  const size = quran.readerSize ?? DEFAULT_SIZE;
  const translation: TranslationId = quran.translation === 'rashid' ? 'rashid' : 'hamidullah';
  const text = useAsync(() => getSurahText(number, mode === 'arabic' ? null : translation), [number, mode, translation]);
  const [selected, setSelected] = useState<number | null>(null);
  const [sharing, setSharing] = useState<SharedVerse | null>(null);
  // Mémorisation : arabe masqué ; on touche un verset pour le révéler après l'avoir récité.
  const [memo, setMemo] = useState(false);
  const [hint, setHint] = useState(true);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const memoOn = memo && mode !== 'translation';
  const isHidden = (ayah: number) => memoOn && !revealed.has(ayah);
  const onVerse = (ayah: number) => {
    if (isHidden(ayah)) {
      setRevealed((r) => new Set(r).add(ayah));
      setSelected(ayah);
      return;
    }
    setSelected(selected === ayah ? null : ayah);
  };
  const [copied, setCopied] = useState(false);
  const verseRefs = useRef(new Map<number, HTMLElement>());
  // Verset en haut de l'écran : bandeau « sourate · juz · page ».
  const [topAyah, setTopAyah] = useState(1);

  // Écouter en lisant : récitateur minuté verset par verset.
  const player = usePlayer();
  const reciter = useQuranReciter(number);
  const episode = reciter ? surahEpisode(reciter.reciter, reciter.moshaf, number) : null;
  const timings = useAsync(() => (reciter ? getAyahTimings(number, reciter.moshaf.id) : Promise.resolve(null)), [number, reciter?.moshaf.id]);
  const isCurrent = !!episode && player.current?.id === episode.id;
  const listening = isCurrent && player.isPlaying;
  const playFrom = (ayah?: number) => {
    if (!episode) return;
    const start = ayah ? timings.data?.find((t) => t.ayah === ayah)?.start : undefined;
    if (isCurrent && start === undefined) return player.toggle();
    if (isCurrent && start !== undefined) {
      player.seek(start);
      if (!player.isPlaying) player.toggle();
      return;
    }
    player.play(episode, start);
  };
  const target = Number(params.get('v')) || null;

  const bookmarks = quran.bookmarks ?? [];
  const isBookmarked = (ayah: number) => bookmarks.some((b) => b.surah === number && b.ayah === ayah);
  const toggleBookmark = (ayah: number) =>
    set({
      bookmarks: isBookmarked(ayah) ? bookmarks.filter((b) => b.surah !== number || b.ayah !== ayah) : [...bookmarks, { surah: number, ayah, at: Date.now() }],
    });

  // Ouverture sur un verset précis (reprise, marque-page) ; sinon en haut de la sourate.
  useEffect(() => {
    setSelected(null);
    setRevealed(new Set());
    if (!text.data) return;
    const el = target ? verseRefs.current.get(target) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    else document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [text.data, target, number]);

  // Retient le verset en haut de l'écran (« Reprendre la lecture »).
  const settingsRef = useRef(quran);
  settingsRef.current = quran;
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!text.data) return;
    let pending: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.ayah));
        if (!visible.length) return;
        pending = Math.min(...visible);
        setTopAyah(pending);
        clearTimeout(timer);
        timer = setTimeout(() => {
          const last = settingsRef.current.lastRead;
          if (pending && (last?.surah !== number || last.ayah !== pending)) setRef.current({ lastRead: { surah: number, ayah: pending, at: Date.now() } });
        }, 1200);
      },
      { rootMargin: '-15% 0px -60% 0px' },
    );
    verseRefs.current.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [text.data, number]);

  const copy = async (ayah: number) => {
    const a = text.data?.find((x) => x.number === ayah);
    if (!a) return;
    const content = [a.arabic, a.translation, `— ${s.name} (${s.number}:${ayah})`].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible
    }
  };

  const ref = (ayah: number) => (el: HTMLElement | null) => {
    if (el) verseRefs.current.set(ayah, el);
    else verseRefs.current.delete(ayah);
  };
  // Débuts de page du mushaf dans cette sourate (mode mushaf : « Page N » entre les versets).
  const pageStarts = new Map(PAGE_STARTS.flatMap(([su, ay], i) => (su === number ? [[ay, i + 1] as const] : [])));
  const sizeIndex = Math.max(0, SIZES.indexOf(size));
  const style = { '--read-size': `${size}px` } as React.CSSProperties;

  return (
    <div className="page quran-read" style={style}>
      <div className="read-top">
        <Link to="/lire" className="btn btn--ghost btn--small">
          <ChevronLeft size={16} /> Sourates
        </Link>
        {reciter && (
          <Link to={`/coran/${reciter.reciter.id}/${number}?m=${reciter.moshaf.id}`} className="small muted read-top__reciter" title="Changer de récitateur ou répéter un passage">
            <Headphones size={14} /> {reciter.reciter.name}
          </Link>
        )}
      </div>

      <header className="read-head">
        <p className="read-head__arabic" lang="ar" dir="rtl">
          {s.arabic}
        </p>
        <h1>
          {s.number}. {s.name}
        </h1>
        <p className="muted">
          {s.meaning} · {s.ayahs} versets · {s.revelation} ·{' '}
          {pageOf({ surah: number, ayah: 1 }) === pageOf({ surah: number, ayah: s.ayahs })
            ? `page ${pageOf({ surah: number, ayah: 1 })}`
            : `pages ${pageOf({ surah: number, ayah: 1 })}–${pageOf({ surah: number, ayah: s.ayahs })}`}
        </p>
      </header>

      <div className="read-tools">
        <div className="read-sticky">
          <button className={`read-sticky__play ${listening ? 'is-on' : ''}`} onClick={() => playFrom()} disabled={!episode} aria-label={listening ? 'Pause' : 'Écouter en lisant'}>
            {listening ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <span className="read-sticky__where">
            <strong>
              {s.name} · {number}:{topAyah}
            </strong>
            <span className="small muted">
              Juz {juzOf({ surah: number, ayah: topAyah })} · Page {pageOf({ surah: number, ayah: topAyah })}
              {episode ? (listening ? ' · lecture suivie' : ' · écouter en lisant') : ''}
            </span>
          </span>
        </div>
        <Tabs tabs={MODES} value={mode} onChange={(readerMode) => set({ readerMode })} />
        <div className="read-tools__row">
          {mode !== 'arabic' && (
            <select className="input read-tools__select" value={translation} onChange={(e) => set({ translation: e.target.value as TranslationId })} aria-label="Traduction">
              {TRANSLATIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {mode !== 'translation' && (
            <button className={`btn btn--small ${memo ? 'btn--primary' : 'btn--outline'}`} onClick={() => setMemo(!memo)} aria-pressed={memo}>
              <Brain size={15} /> Mémoriser
            </button>
          )}
          <span className="read-size" role="group" aria-label="Taille du texte">
            <button className="icon-btn" disabled={sizeIndex === 0} onClick={() => set({ readerSize: SIZES[sizeIndex - 1] })} aria-label="Texte plus petit">
              <Minus size={16} />
            </button>
            <span className="small">Aa</span>
            <button className="icon-btn" disabled={sizeIndex === SIZES.length - 1} onClick={() => set({ readerSize: SIZES[sizeIndex + 1] })} aria-label="Texte plus grand">
              <Plus size={16} />
            </button>
          </span>
        </div>
      </div>

      {memoOn && (
        <div className="memo-bar">
          <p className="small">
            Récitez chaque verset de mémoire, puis touchez-le pour vérifier. Pour répéter un passage à l’écoute, choisissez un verset puis « Répéter ».
          </p>
          <div className="row-actions">
            <label className="memo-bar__hint">
              <input type="checkbox" checked={hint} onChange={(e) => setHint(e.target.checked)} /> Indice : premier mot
            </label>
            <button className="btn btn--ghost btn--small" onClick={() => setRevealed(new Set(text.data?.map((x) => x.number) ?? []))}>
              <Eye size={15} /> Tout révéler
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => setRevealed(new Set())}>
              <EyeOff size={15} /> Tout masquer
            </button>
          </div>
        </div>
      )}

      {mode !== 'arabic' && (
        <p className="scholar-notice">
          <Info size={16} /> {SCHOLAR_NOTICE}
        </p>
      )}

      {number !== 1 && number !== 9 && mode !== 'translation' && (
        <p className="read-basmala" lang="ar" dir="rtl">
          {BASMALA}
        </p>
      )}

      {text.loading && !text.data ? (
        <Spinner label="Chargement du texte…" />
      ) : text.error ? (
        <ErrorState error={text.error} onRetry={text.reload} />
      ) : mode === 'arabic' ? (
        <p className="read-mushaf" lang="ar" dir="rtl">
          {text.data?.map((a) => (
            <span key={a.number}>
            {a.number > 1 && pageStarts.has(a.number) && (
              <span className="mushaf-page" dir="ltr">
                Page {pageStarts.get(a.number)}
              </span>
            )}
            <span
              ref={ref(a.number)}
              data-ayah={a.number}
              className={`read-mushaf__ayah ${selected === a.number ? 'is-selected' : ''} ${target === a.number ? 'is-target' : ''}`}
              onClick={() => onVerse(a.number)}
            >
              {isHidden(a.number) ? <HiddenArabic text={a.arabic} hint={hint} /> : a.arabic}{' '}
              <span className="read-marker" aria-label={`verset ${a.number}`}>
                {arabicNumber(a.number)}
              </span>{' '}
            </span>
            </span>
          ))}
        </p>
      ) : (
        <ol className="read-ayahs">
          {text.data?.map((a) => (
            <li
              key={a.number}
              ref={ref(a.number)}
              data-ayah={a.number}
              className={`read-ayah ${target === a.number ? 'is-target' : ''}`}
              onClick={() => isHidden(a.number) && onVerse(a.number)}
            >
              <span className="read-ayah__head">
                <span className="read-ayah__number">
                  {s.number}:{a.number}
                </span>
                <span className="read-ayah__actions" onClick={(e) => e.stopPropagation()}>
                  {timings.data && (
                    <button className="icon-btn" onClick={() => playFrom(a.number)} aria-label={`Écouter à partir du verset ${a.number}`} title="Écouter à partir d’ici">
                      <Play size={15} />
                    </button>
                  )}
                  <button className={`icon-btn ${isBookmarked(a.number) ? 'icon-btn--active' : ''}`} onClick={() => toggleBookmark(a.number)} aria-label="Marque-page" title={isBookmarked(a.number) ? 'Retirer le marque-page' : 'Marque-page'}>
                    {isBookmarked(a.number) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setSharing({ surah: number, ayah: a.number, arabic: a.arabic, translation: a.translation, translationId: a.translation ? translation : undefined })}
                    aria-label="Partager en image"
                    title="Partager en image"
                  >
                    <ImageIcon size={15} />
                  </button>
                  <button className="icon-btn" onClick={() => void copy(a.number)} aria-label="Copier" title={copied ? 'Copié' : 'Copier'}>
                    <Copy size={15} />
                  </button>
                  {memoOn && <ListenLink surah={number} from={a.number} label="" icon={<Repeat size={15} />} />}
                </span>
              </span>
              {mode === 'both' && (
                <p className="read-ayah__arabic" lang="ar" dir="rtl">
                  {isHidden(a.number) ? <HiddenArabic text={a.arabic} hint={hint} /> : a.arabic} <span className="read-marker">{arabicNumber(a.number)}</span>
                </p>
              )}
              {a.translation && <p className="read-ayah__translation">{a.translation}</p>}
            </li>
          ))}
        </ol>
      )}

      <FollowAlong timings={timings.data ?? null} active={isCurrent} verses={verseRefs.current} />

      {selected !== null && mode === 'arabic' && (
        <div className="read-actions" role="toolbar" aria-label={`Verset ${selected}`}>
          <span className="small">
            {s.name} · verset {selected}
          </span>
          <button className="btn btn--ghost btn--small" onClick={() => toggleBookmark(selected)}>
            {isBookmarked(selected) ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {isBookmarked(selected) ? 'Marqué' : 'Marque-page'}
          </button>
          <button
            className="btn btn--ghost btn--small"
            onClick={() => {
              const a = text.data?.find((x) => x.number === selected);
              if (a) setSharing({ surah: number, ayah: selected, arabic: a.arabic, translation: a.translation, translationId: a.translation ? translation : undefined });
            }}
          >
            <ImageIcon size={15} /> Image
          </button>
          <ListenLink surah={number} from={selected} label="Répéter" icon={<Repeat size={15} />} />
          <button className="btn btn--ghost btn--small" onClick={() => void copy(selected)}>
            <Copy size={15} /> {copied ? 'Copié' : 'Copier'}
          </button>
          <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
      )}

      <p className="small muted read-source">
        Texte arabe : édition Uthmani (Hafs).{' '}
        {mode !== 'arabic' && <>Traduction : {TRANSLATIONS.find((t) => t.id === translation)?.source} </>}
        Podsal ne traduit jamais le Coran lui-même : seules des traductions officielles revues par des savants sont affichées.
      </p>

      {sharing && <VerseShareDialog verse={sharing} onClose={() => setSharing(null)} />}

      <nav className="read-nav" aria-label="Sourates voisines">
        {number > 1 ? (
          <button className="btn btn--outline" onClick={() => navigate(`/lire/${number - 1}`)}>
            <ChevronLeft size={16} /> {getSurah(number - 1)!.name}
          </button>
        ) : (
          <span />
        )}
        {number < 114 && (
          <button className="btn btn--outline" onClick={() => navigate(`/lire/${number + 1}`)}>
            {getSurah(number + 1)!.name} <ChevronRight size={16} />
          </button>
        )}
      </nav>
    </div>
  );
}
