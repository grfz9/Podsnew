import { idbGet, idbPut } from '../lib/idb';
import { indexVerses, type IndexedVerse, type SearchVerse } from '../lib/quranSearch';

/**
 * Texte complet du Coran pour la recherche : arabe sans voyelles (« quran-simple-clean ») et traduction
 * de Muhammad Hamidullah, servis par alquran.cloud (Tanzil). Téléchargé une fois (≈ 2,5 Mo) puis gardé
 * sur l'appareil : la recherche fonctionne ensuite hors-ligne.
 */
const ALQURAN = 'https://api.alquran.cloud/v1';
const CACHE_KEY = 'quran-search-v1';
const BASMALA_CLEAN = 'بسم الله الرحمن الرحيم';

type Edition = { data: { surahs: { number: number; ayahs: { numberInSurah: number; text: string }[] }[] } };

async function edition(name: string): Promise<Edition> {
  const res = await fetch(`${ALQURAN}/quran/${name}`);
  if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
  return res.json() as Promise<Edition>;
}

async function download(): Promise<SearchVerse[]> {
  const [ar, fr] = await Promise.all([edition('quran-simple-clean'), edition('fr.hamidullah')]);
  const out: SearchVerse[] = [];
  ar.data.surahs.forEach((s, i) => {
    s.ayahs.forEach((a, j) => {
      let arabic = a.text;
      // La basmala précède le 1er verset dans cette édition (sauf sourates 1 et 9) : elle n'en fait pas partie.
      if (a.numberInSurah === 1 && s.number !== 1 && s.number !== 9 && arabic.startsWith(BASMALA_CLEAN)) arabic = arabic.slice(BASMALA_CLEAN.length).trim();
      out.push({ surah: s.number, ayah: a.numberInSurah, arabic, french: fr.data.surahs[i]?.ayahs[j]?.text ?? '' });
    });
  });
  return out;
}

let indexPromise: Promise<IndexedVerse[]> | null = null;

export function getSearchIndex(): Promise<IndexedVerse[]> {
  indexPromise ??= (async () => {
    let verses = await idbGet<SearchVerse[]>('kv', CACHE_KEY).catch(() => undefined);
    if (!verses?.length) {
      verses = await download();
      await idbPut('kv', verses, CACHE_KEY).catch(() => undefined);
    }
    return indexVerses(verses);
  })();
  indexPromise.catch(() => {
    indexPromise = null;
  });
  return indexPromise;
}
