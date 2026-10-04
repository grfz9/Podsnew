import { Link } from 'react-router';
import { BookOpenText, Sun } from 'lucide-react';
import { getVerse, SCHOLAR_NOTICE, TRANSLATIONS, type TranslationId } from '../api/quran';
import { dailyVerse, today } from '../data/dailyVerses';
import { getSurah } from '../data/surahs';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { useAsync } from '../utils/hooks';

/** « Verset du jour » : un verset connu, propre à chaque personne et qui change chaque jour, avec sa traduction officielle. */
export function DailyVerse() {
  const auth = useAuth();
  const library = useLibrary();
  const translation: TranslationId = library.settings.quran.translation === 'rashid' ? 'rashid' : 'hamidullah';
  const day = today();
  const { surah, ayah } = dailyVerse(auth.userId ?? library.deviceId, day);
  const s = getSurah(surah)!;
  const verse = useAsync(() => getVerse(surah, ayah, translation), [surah, ayah, translation]);

  if (verse.error) return null;
  return (
    <section className="daily-verse" aria-label="Verset du jour">
      <header className="daily-verse__head">
        <span className="daily-verse__label">
          <Sun size={15} /> Verset du jour
        </span>
        <span className="small muted">
          {s.name} · {surah}:{ayah}
        </span>
      </header>
      {verse.data ? (
        <>
          <p className="daily-verse__arabic" lang="ar" dir="rtl">
            {verse.data.arabic}
          </p>
          {verse.data.translation && <p className="daily-verse__translation">{verse.data.translation}</p>}
          <div className="daily-verse__actions">
            <Link to={`/lire/${surah}?v=${ayah}`} className="btn btn--outline btn--small">
              <BookOpenText size={15} /> Lire la sourate
            </Link>
          </div>
          <p className="small muted daily-verse__source">
            Traduction : {TRANSLATIONS.find((t) => t.id === translation)?.label}. {SCHOLAR_NOTICE}
          </p>
        </>
      ) : (
        <p className="small muted">Chargement du verset…</p>
      )}
    </section>
  );
}
