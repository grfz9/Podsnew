import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { ayahAt, BASMALA, getAyahTimings, getSurahText, parseSurahEpisodeId, TRANSLATIONS, type TranslationId } from '../api/quran';
import { useLibrary } from '../store/library';
import { usePlayer, usePlayerTime } from '../store/player';
import type { Episode } from '../types';
import { useAsync } from '../utils/hooks';
import { Spinner } from './common';

/** Délai après un défilement manuel avant de reprendre le suivi automatique. */
const RESUME_FOLLOW_MS = 6000;

/**
 * Versets de la sourate en cours d'écoute, dans le grand lecteur : le verset récité est mis en avant
 * et reste au centre (comme des paroles), avec l'arabe et la traduction choisie. Toucher un verset y mène.
 */
export function QuranVerses({ episode }: { episode: Episode }) {
  const parsed = parseSurahEpisodeId(episode.id);
  const library = useLibrary();
  const player = usePlayer();
  const { time } = usePlayerTime();
  const settings = library.settings.quran;
  const translation: TranslationId | null = settings.translation === 'none' ? null : settings.translation;
  const surah = parsed?.surah ?? 1;
  const text = useAsync(() => (parsed ? getSurahText(surah, translation) : Promise.resolve([])), [surah, translation]);
  const timings = useAsync(() => (parsed ? getAyahTimings(surah, parsed.moshafId) : Promise.resolve(null)), [surah, parsed?.moshafId]);
  const current = timings.data ? ayahAt(timings.data, time) : null;

  const box = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const userScroll = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Garde le verset récité au centre de la zone (sans faire défiler toute la page).
  useEffect(() => {
    const container = box.current;
    if (!follow || !current || !container) return;
    const el = container.querySelector<HTMLElement>(`[data-ayah="${current}"]`);
    if (!el) return;
    container.scrollTo({ top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' });
  }, [current, follow, text.data]);

  useEffect(() => () => clearTimeout(userScroll.current), []);

  // Seuls les gestes de l'utilisateur (doigt, molette) suspendent le suivi, pas le défilement automatique.
  const onUserScroll = () => {
    setFollow(false);
    clearTimeout(userScroll.current);
    userScroll.current = setTimeout(() => setFollow(true), RESUME_FOLLOW_MS);
  };

  const setQuran = (patch: Partial<typeof settings>) => library.setSettings({ quran: { ...settings, ...patch } });

  const goTo = (ayah: number) => {
    const t = timings.data?.find((x) => x.ayah === ayah);
    if (!t) return;
    setFollow(true);
    if (player.current?.id === episode.id) player.seek(t.start);
    else player.play(episode, t.start);
  };

  if (!parsed) return null;

  return (
    <section className="verses" aria-label="Versets de la sourate">
      <div className="verses__tools">
        <label className="verses__select">
          <span className="sr-only">Traduction</span>
          <select value={settings.translation} onChange={(e) => setQuran({ translation: e.target.value as typeof settings.translation })}>
            {TRANSLATIONS.map((t) => (
              <option key={t.id} value={t.id}>
                Traduction : {t.label}
              </option>
            ))}
            <option value="none">Sans traduction</option>
          </select>
        </label>
        <button className={`verses__chip ${settings.showArabic ? 'verses__chip--on' : ''}`} aria-pressed={settings.showArabic} onClick={() => setQuran({ showArabic: !settings.showArabic })}>
          عربي
        </button>
      </div>

      <div className="verses__scroll" ref={box} onTouchMove={onUserScroll} onWheel={onUserScroll}>
        {text.loading && !text.data ? (
          <Spinner label="Chargement des versets…" />
        ) : text.error ? (
          <p className="small muted">Le texte de la sourate n’a pas pu être chargé.</p>
        ) : (
          <>
            {surah !== 1 && surah !== 9 && settings.showArabic && (
              <p className="verses__basmala" lang="ar" dir="rtl">
                {BASMALA}
              </p>
            )}
            {text.data?.map((a) => {
              const state = current === null ? '' : a.number === current ? 'verse--active' : a.number < current ? 'verse--past' : '';
              return (
                <button key={a.number} data-ayah={a.number} className={`verse ${state}`} onClick={() => goTo(a.number)} disabled={!timings.data}>
                  <span className="verse__number">{a.number}</span>
                  {settings.showArabic && (
                    <span className="verse__arabic" lang="ar" dir="rtl">
                      {a.arabic}
                    </span>
                  )}
                  {a.translation && <span className="verse__translation">{a.translation}</span>}
                </button>
              );
            })}
          </>
        )}
      </div>

      {!follow && current && (
        <button className="btn btn--outline btn--small verses__back" onClick={() => setFollow(true)}>
          <LocateFixed size={14} /> Revenir au verset en cours
        </button>
      )}
      {!timings.loading && !timings.data && (
        <p className="small muted verses__note">Pour cette récitation, le texte s’affiche sans suivre la voix.</p>
      )}
    </section>
  );
}
