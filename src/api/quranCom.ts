/**
 * Données de quran.com (API publique v4) pour la lecture : texte avec les règles de tajwid en couleurs,
 * et mot par mot (phonétique et sens de chaque mot, en anglais : quran.com ne propose pas le français).
 * Mises en cache par sourate pendant la session.
 */
const API = 'https://api.quran.com/api/v4';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
  return res.json() as Promise<T>;
}

export interface TajweedPart {
  text: string;
  /** Règle de tajwid (ham_wasl, ghunnah, qalaqah…) ; absente pour le texte ordinaire. */
  rule?: string;
}

/** « بِسْمِ <tajweed class=ham_wasl>ٱ</tajweed>للَّهِ » → morceaux colorables, sans HTML injecté dans la page. */
export function parseTajweed(text: string): TajweedPart[] {
  const parts: TajweedPart[] = [];
  const clean = text.replace(/<span class=end>[\s\S]*?<\/span>/g, '').trim();
  const re = /<tajweed class=([a-z_]+)>([\s\S]*?)<\/tajweed>/g;
  let last = 0;
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    if (m.index > last) parts.push({ text: clean.slice(last, m.index) });
    parts.push({ text: m[2], rule: m[1] });
    last = m.index + m[0].length;
  }
  if (last < clean.length) parts.push({ text: clean.slice(last) });
  // Balises inconnues éventuelles : retirées, le texte reste.
  return parts.map((p) => ({ ...p, text: p.text.replace(/<[^>]+>/g, '') })).filter((p) => p.text);
}

/** Règles de tajwid affichées (couleurs proches de quran.com), pour la légende. */
export const TAJWEED_RULES: { rule: string; label: string }[] = [
  { rule: 'ham_wasl', label: 'Hamzat al-wasl' },
  { rule: 'laam_shamsiyah', label: 'Lam solaire' },
  { rule: 'slnt', label: 'Lettre muette' },
  { rule: 'madda_normal', label: 'Madd naturel (2)' },
  { rule: 'madda_permissible', label: 'Madd permis (2, 4, 6)' },
  { rule: 'madda_necessary', label: 'Madd nécessaire (6)' },
  { rule: 'madda_obligatory', label: 'Madd obligatoire (4, 5)' },
  { rule: 'qalaqah', label: 'Qalqala' },
  { rule: 'ghunnah', label: 'Ghunna' },
  { rule: 'ikhafa', label: 'Ikhfa' },
  { rule: 'ikhafa_shafawi', label: 'Ikhfa shafawi' },
  { rule: 'idgham_ghunnah', label: 'Idgham avec ghunna' },
  { rule: 'idgham_wo_ghunnah', label: 'Idgham sans ghunna' },
  { rule: 'idgham_shafawi', label: 'Idgham shafawi' },
  { rule: 'idgham_mutajanisayn', label: 'Idgham mutajanisayn' },
  { rule: 'idgham_mutaqaribayn', label: 'Idgham mutaqaribayn' },
  { rule: 'iqlab', label: 'Iqlab' },
];

const tajweedCache = new Map<number, Promise<Map<number, TajweedPart[]>>>();

/** Texte tajwid de chaque verset d'une sourate. */
export function getTajweed(surah: number): Promise<Map<number, TajweedPart[]>> {
  let hit = tajweedCache.get(surah);
  if (!hit) {
    hit = getJson<{ verses: { verse_key: string; text_uthmani_tajweed: string }[] }>(`${API}/quran/verses/uthmani_tajweed?chapter_number=${surah}`).then(
      (d) => new Map(d.verses.map((v) => [Number(v.verse_key.split(':')[1]), parseTajweed(v.text_uthmani_tajweed)])),
    );
    hit.catch(() => tajweedCache.delete(surah));
    tajweedCache.set(surah, hit);
  }
  return hit;
}

export interface QuranWord {
  text: string;
  translit: string;
  /** Sens du mot en anglais (quran.com). */
  meaning: string;
}

const wordsCache = new Map<number, Promise<Map<number, QuranWord[]>>>();

/** Mot par mot d'une sourate (par pages de 50 versets, limite de l'API). */
export function getWords(surah: number): Promise<Map<number, QuranWord[]>> {
  let hit = wordsCache.get(surah);
  if (!hit) {
    hit = (async () => {
      const out = new Map<number, QuranWord[]>();
      for (let page = 1; page <= 10; page++) {
        const d = await getJson<{
          verses: { verse_key: string; words: { char_type_name: string; text_uthmani: string; transliteration?: { text: string | null }; translation?: { text: string | null } }[] }[];
          pagination: { total_pages: number };
        }>(`${API}/verses/by_chapter/${surah}?words=true&word_fields=text_uthmani&word_translation_language=en&per_page=50&page=${page}`);
        for (const v of d.verses) {
          out.set(
            Number(v.verse_key.split(':')[1]),
            v.words.filter((w) => w.char_type_name === 'word').map((w) => ({ text: w.text_uthmani, translit: w.transliteration?.text ?? '', meaning: w.translation?.text ?? '' })),
          );
        }
        if (page >= d.pagination.total_pages) break;
      }
      return out;
    })();
    hit.catch(() => wordsCache.delete(surah));
    wordsCache.set(surah, hit);
  }
  return hit;
}
