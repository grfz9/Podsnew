import type { Episode } from '../types';
import { getSurah } from '../data/surahs';
import { QURAN_PREFIX } from '../lib/policy';

/**
 * Coran :
 * - récitations : mp3quran.net (récitateurs, riwayat, fichiers audio par sourate, minutage des versets) ;
 * - texte arabe : alquran.cloud (édition « quran-uthmani », lecture Hafs) ;
 * - traductions françaises : QuranEnc.com (projet du Centre Rowwad at-Tarjama et d'IslamHouse,
 *   traductions revues), avec repli sur alquran.cloud pour Hamidullah.
 */
const MP3QURAN = 'https://mp3quran.net/api/v3';
const ALQURAN = 'https://api.alquran.cloud/v1';
const QURANENC = 'https://quranenc.com/api/v1';

export interface Moshaf {
  id: number;
  /** Nom complet renvoyé par l'API (ex. « Rewayat Hafs A'n Assem - Murattal »). */
  name: string;
  riwaya: string;
  style: string;
  server: string;
  surahs: number[];
}

export interface Reciter {
  id: number;
  name: string;
  moshaf: Moshaf[];
}

interface RawReciter {
  id: number;
  name: string;
  moshaf: { id: number; name: string; server: string; surah_total: number; surah_list: string }[];
}

const RIWAYAT: [RegExp, string][] = [
  [/hafs|حفص/i, 'Hafs ʿan ʿĀsim'],
  [/warsh|ورش/i, 'Warsh ʿan Nāfiʿ'],
  [/qalon|qaloon|qalun|قالون/i, 'Qālūn ʿan Nāfiʿ'],
  [/sho?u?'?bah?|shu'?ba|شعبة/i, 'Shuʿba ʿan ʿĀsim'],
  [/dou?ri|duri|الدوري/i, 'Ad-Dūrī'],
  [/sou?si|susi|السوسي/i, 'As-Sūsī ʿan Abī ʿAmr'],
  [/bazzi|البزي/i, 'Al-Bazzī ʿan Ibn Kathīr'],
  [/qunbul|قنبل/i, 'Qunbul ʿan Ibn Kathīr'],
  [/khalaf|خلف/i, 'Khalaf ʿan Ḥamza'],
  [/khallad|خلاد/i, 'Khallād ʿan Ḥamza'],
  [/hisham|هشام/i, 'Hishām ʿan Ibn ʿĀmir'],
  [/thakwan|dhakwan|ذكوان/i, 'Ibn Dhakwān ʿan Ibn ʿĀmir'],
];

const STYLES: [RegExp, string][] = [
  [/mujaw+ad|مجود/i, 'Mujawwad'],
  [/mu'?al+im|teacher|معلم/i, 'Muʿallim (pour apprendre)'],
  [/murat+al|مرتل/i, 'Murattal'],
];

/** « Rewayat Hafs A'n Assem - Murattal » → riwaya « Hafs ʿan ʿĀsim », style « Murattal ». */
export function parseMoshafName(name: string): { riwaya: string; style: string } {
  const [first, ...rest] = name.split(' - ');
  const riwaya = RIWAYAT.find(([re]) => re.test(first))?.[1] ?? first.replace(/^rewayat\s+/i, '').trim();
  const styleText = rest.join(' - ') || name;
  const style = STYLES.find(([re]) => re.test(styleText))?.[1] ?? (rest.join(' - ').trim() || 'Murattal');
  return { riwaya, style };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Erreur réseau (${res.status})`);
  return res.json() as Promise<T>;
}

let recitersPromise: Promise<Reciter[]> | null = null;

export function getReciters(): Promise<Reciter[]> {
  recitersPromise ??= getJson<{ reciters: RawReciter[] }>(`${MP3QURAN}/reciters?language=fr`)
    .then((data) =>
      data.reciters
        .map((r) => ({
          id: r.id,
          name: r.name.trim(),
          moshaf: r.moshaf.map((m) => ({
            id: m.id,
            name: m.name,
            ...parseMoshafName(m.name),
            server: m.server.endsWith('/') ? m.server : `${m.server}/`,
            surahs: m.surah_list
              .split(',')
              .map(Number)
              .filter((n) => n >= 1 && n <= 114),
          })),
        }))
        .filter((r) => r.moshaf.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    )
    .catch((error) => {
      recitersPromise = null;
      throw error;
    });
  return recitersPromise;
}

export async function getReciter(id: number): Promise<Reciter> {
  const reciter = (await getReciters()).find((r) => r.id === id);
  if (!reciter) throw new Error('Récitateur introuvable');
  return reciter;
}

export function surahAudioUrl(moshaf: Moshaf, surah: number): string {
  return `${moshaf.server}${String(surah).padStart(3, '0')}.mp3`;
}

export const quranPodcastId = (reciterId: number) => `${QURAN_PREFIX}${reciterId}`;

/** Une sourate récitée, sous la forme d'un « épisode » lisible par le lecteur. */
export function surahEpisode(reciter: Pick<Reciter, 'id' | 'name'>, moshaf: Moshaf, surah: number): Episode {
  const s = getSurah(surah)!;
  return {
    id: `q-${moshaf.id}-${surah}`,
    podcastId: quranPodcastId(reciter.id),
    podcastTitle: reciter.name,
    title: `${surah}. ${s.name} — ${s.meaning}`,
    description: `\u2068${s.arabic}\u2069 · ${s.ayahs} versets · ${moshaf.riwaya}`,
    audioUrl: surahAudioUrl(moshaf, surah),
    duration: 0,
    releaseDate: '',
    artwork: '',
    genre: 'Coran',
  };
}

/** Décompose l'identifiant d'un épisode de Coran : « q-<moshaf>-<sourate> ». */
export function parseSurahEpisodeId(id: string): { moshafId: number; surah: number } | null {
  const m = id.match(/^q-(\d+)-(\d+)$/);
  return m ? { moshafId: Number(m[1]), surah: Number(m[2]) } : null;
}

/* ---------- Texte et traductions ---------- */

export type TranslationId = 'rashid' | 'hamidullah';

export const TRANSLATIONS: { id: TranslationId; label: string; source: string }[] = [
  {
    id: 'rashid',
    label: 'Rachid Maach',
    source: 'Traduction de Rachid Maach, revue et publiée par le Centre Rowwad at-Tarjama (QuranEnc.com).',
  },
  {
    id: 'hamidullah',
    label: 'Muhammad Hamidullah',
    source: 'Traduction de Muhammad Hamidullah, édition revue par le Complexe du Roi Fahd (QuranEnc.com).',
  },
];

const QURANENC_KEYS: Record<TranslationId, string> = { rashid: 'french_rashid', hamidullah: 'french_hameedullah' };

export interface Ayah {
  number: number;
  arabic: string;
  translation?: string;
  footnotes?: string;
}

export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/** L'édition Uthmani inclut la basmala au début du premier verset (sauf sourates 1 et 9) : on l'affiche à part. */
export function stripBasmala(surah: number, ayah: number, text: string): string {
  if (surah === 1 || surah === 9 || ayah !== 1) return text;
  return text.startsWith(BASMALA) ? text.slice(BASMALA.length).trim() : text;
}

const textCache = new Map<string, Promise<Ayah[]>>();

async function arabicText(surah: number): Promise<string[]> {
  const data = await getJson<{ data: { ayahs: { numberInSurah: number; text: string }[] } }>(`${ALQURAN}/surah/${surah}/quran-uthmani`);
  return data.data.ayahs.map((a) => stripBasmala(surah, a.numberInSurah, a.text));
}

async function translationText(surah: number, id: TranslationId): Promise<{ text: string; footnotes?: string }[]> {
  try {
    const data = await getJson<{ result: { aya: string | number; translation: string; footnotes?: string }[] }>(
      `${QURANENC}/translation/sura/${QURANENC_KEYS[id]}/${surah}`,
    );
    return data.result.map((r) => ({ text: r.translation.trim(), footnotes: r.footnotes?.trim() || undefined }));
  } catch (error) {
    if (id !== 'hamidullah') throw error;
    // Repli : la même traduction de Hamidullah, servie par alquran.cloud.
    const data = await getJson<{ data: { ayahs: { text: string }[] } }>(`${ALQURAN}/surah/${surah}/fr.hamidullah`);
    return data.data.ayahs.map((a) => ({ text: a.text.trim() }));
  }
}

export function getSurahText(surah: number, translation: TranslationId | null): Promise<Ayah[]> {
  const key = `${surah}|${translation ?? ''}`;
  let hit = textCache.get(key);
  if (!hit) {
    hit = Promise.all([arabicText(surah), translation ? translationText(surah, translation) : Promise.resolve([])]).then(
      ([arabic, translated]) =>
        arabic.map((text, i) => ({
          number: i + 1,
          arabic: text,
          translation: translated[i]?.text,
          footnotes: translated[i]?.footnotes,
        })),
    );
    hit.catch(() => textCache.delete(key));
    textCache.set(key, hit);
  }
  return hit;
}

/* ---------- Minutage des versets ---------- */

export interface AyahTiming {
  ayah: number;
  start: number;
  end: number;
}

/**
 * Début et fin de chaque verset dans l'enregistrement (disponible pour une partie des récitateurs).
 * Sert à surligner le verset en cours et à répéter un passage précis.
 */
export async function getAyahTimings(surah: number, moshafId: number): Promise<AyahTiming[] | null> {
  try {
    const data = await getJson<{ ayah: number; start_time: number; end_time: number }[]>(
      `${MP3QURAN}/ayat_timing?surah=${surah}&read=${moshafId}`,
    );
    if (!Array.isArray(data)) return null;
    const timings = data
      .filter((t) => t.ayah >= 1 && Number.isFinite(t.start_time) && Number.isFinite(t.end_time) && t.end_time > t.start_time)
      .map((t) => ({ ayah: t.ayah, start: t.start_time / 1000, end: t.end_time / 1000 }));
    return timings.length ? timings : null;
  } catch {
    return null;
  }
}

export function ayahAt(timings: AyahTiming[], time: number): number | null {
  const t = timings.find((x) => time >= x.start && time < x.end);
  return t ? t.ayah : null;
}
