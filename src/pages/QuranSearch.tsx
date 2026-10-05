import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronLeft, Info, Search, X } from 'lucide-react';
import { getSearchIndex } from '../api/quranSearch';
import { ErrorState, Spinner } from '../components/common';
import { getSurah } from '../data/surahs';
import { highlightFr, isArabicQuery, searchVerses } from '../lib/quranSearch';
import { useAsync, useDebounced } from '../utils/hooks';

const EXAMPLES = ['patience', 'miséricorde', 'paradis', 'Moïse', 'الصبر'];

/** Recherche d'un mot dans tout le Coran : traduction française (Hamidullah) ou texte arabe. */
export function QuranSearchPage() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const query = useDebounced(input.trim(), 250);
  const index = useAsync(() => getSearchIndex(), []);

  useEffect(() => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (query) next.set('q', query);
      else next.delete('q');
      return next;
    }, { replace: true });
  }, [query, setParams]);

  const found = useMemo(() => (index.data && query.length >= 2 ? searchVerses(index.data, query) : null), [index.data, query]);
  const arabic = isArabicQuery(query);

  return (
    <div className="page quran-search">
      <Link to="/lire" className="btn btn--ghost btn--small">
        <ChevronLeft size={16} /> Lire le Coran
      </Link>
      <h1 className="page__title">Rechercher dans le Coran</h1>
      <div className="search-box">
        <Search size={20} />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Un mot en français ou en arabe"
          aria-label="Rechercher dans le Coran"
          autoFocus
          dir="auto"
        />
        {input && (
          <button className="icon-btn" onClick={() => setInput('')} aria-label="Effacer">
            <X size={18} />
          </button>
        )}
      </div>

      {index.loading && !index.data ? (
        <Spinner label="Préparation de la recherche (une seule fois, environ 2 Mo)…" />
      ) : index.error ? (
        <ErrorState error={index.error} onRetry={index.reload} />
      ) : !found ? (
        <div className="quran-search__help">
          <p className="muted">Essayez par exemple :</p>
          <div className="surah-chips">
            {EXAMPLES.map((e) => (
              <button key={e} className="surah-chip" onClick={() => setInput(e)} dir="auto">
                <strong>{e}</strong>
              </button>
            ))}
          </div>
        </div>
      ) : found.total === 0 ? (
        <p className="muted">
          Aucun verset ne contient « {query} ». Essayez un autre mot ou une autre orthographe
          {arabic ? ' (en arabe, essayez aussi sans « ال » : صبر au lieu de الصبر).' : ' (par exemple « endurance » au lieu de « patience »).'}
        </p>
      ) : (
        <>
          <p className="small muted">
            {arabic && query.startsWith('ال') ? 'Astuce : sans « ال », la recherche trouve aussi les autres formes du mot. ' : ''}
            {found.total} verset{found.total > 1 ? 's' : ''}
            {found.total > found.results.length ? ` (les ${found.results.length} premiers affichés)` : ''}
          </p>
          <ol className="search-verses">
            {found.results.map((v) => (
              <li key={`${v.surah}:${v.ayah}`}>
                <Link to={`/lire/${v.surah}?v=${v.ayah}`} className="search-verse">
                  <span className="search-verse__ref">
                    {getSurah(v.surah)?.name} · {v.surah}:{v.ayah}
                  </span>
                  <span className="search-verse__arabic" lang="ar" dir="rtl">
                    {v.arabic}
                  </span>
                  <span className="search-verse__fr">
                    {arabic
                      ? v.french
                      : highlightFr(v.french, query).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="small muted quran-search__source">
        <Info size={13} /> Recherche dans la traduction de Muhammad Hamidullah et dans le texte arabe sans voyelles (alquran.cloud, Tanzil). Le
        texte reste sur l’appareil après la première recherche : elle fonctionne ensuite hors-ligne.
      </p>
    </div>
  );
}
