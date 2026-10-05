/**
 * Recherche dans le Coran, sur l'appareil : texte arabe (sans voyelles) et traduction française.
 * La recherche ignore les accents, la casse et les voyelles arabes ; tous les mots doivent être présents.
 */
export interface SearchVerse {
  surah: number;
  ayah: number;
  arabic: string;
  french: string;
}

export interface IndexedVerse extends SearchVerse {
  arN: string;
  frN: string;
}

const ARABIC_RE = /[؀-ۿ]/;

/** « L'Été, déjà ! » → « l ete deja » */
export function normalizeFr(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Arabe sans voyelles ni signes, formes d'alif, de ya et de ta marbouta unifiées. */
export function normalizeAr(text: string): string {
  return text
    .replace(/[ً-ٰٟۖ-ۭـ]/g, '') // voyelles, signes coraniques, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isArabicQuery = (q: string) => ARABIC_RE.test(q);

export function indexVerses(verses: SearchVerse[]): IndexedVerse[] {
  return verses.map((v) => ({ ...v, arN: ` ${normalizeAr(v.arabic)} `, frN: ` ${normalizeFr(v.french)} ` }));
}

/** Versets qui contiennent tous les mots de la recherche (début de mot en français : « patien » trouve « patience »). */
export function searchVerses(index: IndexedVerse[], query: string, limit = 300): { results: IndexedVerse[]; total: number } {
  const arabic = isArabicQuery(query);
  const words = (arabic ? normalizeAr(query) : normalizeFr(query)).split(' ').filter((w) => w.length >= (arabic ? 2 : 2));
  if (!words.length) return { results: [], total: 0 };
  const needles = words.map((w) => (arabic ? w : ` ${w}`));
  const results: IndexedVerse[] = [];
  let total = 0;
  for (const v of index) {
    const hay = arabic ? v.arN : v.frN;
    if (needles.every((n) => hay.includes(n))) {
      total++;
      if (results.length < limit) results.push(v);
    }
  }
  return { results, total };
}

/** Découpe le texte français en morceaux, en marquant les mots qui commencent par un mot cherché. */
export function highlightFr(text: string, query: string): { text: string; hit: boolean }[] {
  const words = normalizeFr(query).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [{ text, hit: false }];
  return text.split(/(\s+)/).map((part) => {
    const n = normalizeFr(part);
    return { text: part, hit: !!n && n.split(' ').some((w) => words.some((q) => w.startsWith(q))) };
  });
}
