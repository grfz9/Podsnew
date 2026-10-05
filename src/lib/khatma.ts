/**
 * Plan de lecture du Coran (khatma) et calendrier du Ramadan.
 * - Le Coran est découpé selon les 604 pages du mushaf de Médine : chaque jour, le même nombre de pages
 *   (à une page près), donc à peu près le même temps de lecture.
 * - Le Ramadan est estimé avec le calendrier Umm al-Qura du navigateur : la date réelle dépend
 *   de l'observation du croissant et des autorités religieuses de chaque pays.
 */
import { PAGE_STARTS } from '../data/mushaf';
import { SURAHS } from '../data/surahs';

export const TOTAL_PAGES = PAGE_STARTS.length;

export const TOTAL_AYAHS = 6236;

export interface Place {
  surah: number;
  ayah: number;
}

export interface ReadingPlan {
  /** Premier jour du plan (AAAA-MM-JJ, heure locale). */
  start: string;
  days: number;
  /** Jours lus (0 = premier jour). */
  done: number[];
  /** « 30 jours », « Avant Ramadan », « Ramadan 1448 »… */
  label: string;
}

/** Index global (0 à 6235) → sourate et verset. */
export function placeAt(index: number): Place {
  let rest = Math.min(Math.max(0, index), TOTAL_AYAHS - 1);
  for (const s of SURAHS) {
    if (rest < s.ayahs) return { surah: s.number, ayah: rest + 1 };
    rest -= s.ayahs;
  }
  return { surah: 114, ayah: 6 };
}

/** Sourate et verset → index global (0 à 6235). */
export function indexOf(place: Place): number {
  let index = 0;
  for (const s of SURAHS) {
    if (s.number === place.surah) return index + place.ayah - 1;
    index += s.ayahs;
  }
  return TOTAL_AYAHS - 1;
}

/** Portion du jour `day` (0 = premier jour) d'un plan en `days` jours : des pages entières du mushaf. */
export function portion(days: number, day: number): { from: Place; to: Place; ayahs: number; pages: [number, number] } {
  const firstPage = Math.floor((day * TOTAL_PAGES) / days);
  const nextPage = Math.floor(((day + 1) * TOTAL_PAGES) / days);
  const start = indexOf({ surah: PAGE_STARTS[firstPage][0], ayah: PAGE_STARTS[firstPage][1] });
  const end = nextPage >= TOTAL_PAGES ? TOTAL_AYAHS - 1 : indexOf({ surah: PAGE_STARTS[nextPage][0], ayah: PAGE_STARTS[nextPage][1] }) - 1;
  return { from: placeAt(start), to: placeAt(end), ayahs: end - start + 1, pages: [firstPage + 1, nextPage] };
}

export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Nombre de jours entre deux dates (heure locale, indépendant des changements d'heure). */
export function daysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** État du plan aujourd'hui : jour en cours, portion à lire (la première non lue), portions à rattraper. */
export function planStatus(plan: ReadingPlan, now = new Date()) {
  const today = daysBetween(fromDay(plan.start), now); // peut être négatif (plan qui commence plus tard)
  const done = new Set(plan.done);
  const next = Array.from({ length: plan.days }, (_, i) => i).find((i) => !done.has(i));
  const expected = Math.min(plan.days, Math.max(0, today + 1)); // jours qui devraient être lus à la fin d'aujourd'hui
  // Portions à lire pour être à jour ce soir (celle du jour comprise).
  const due = Math.max(0, expected - done.size);
  return {
    started: today >= 0,
    today: Math.min(today, plan.days - 1),
    next,
    finished: next === undefined,
    due,
    progress: done.size / plan.days,
  };
}

/* ---------- Calendrier hégirien (Umm al-Qura) ---------- */

export function hijriParts(date: Date): { day: number; month: number; year: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const result = { day: get('day'), month: get('month'), year: get('year') };
    return Number.isFinite(result.day) && Number.isFinite(result.month) ? result : null;
  } catch {
    return null;
  }
}

export interface RamadanInfo {
  /** Premier et dernier jour (estimés) du Ramadan en cours ou à venir. */
  start: Date;
  end: Date;
  year: number;
  /** Jour du Ramadan (1 à 30) si on y est, sinon null. */
  day: number | null;
  /** Jours avant le début (0 pendant le Ramadan). */
  daysUntil: number;
}

/** Ramadan en cours, ou prochain Ramadan (estimation Umm al-Qura). */
export function ramadanInfo(now = new Date()): RamadanInfo | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (offset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const first = hijriParts(today);
  if (!first) return null;
  let startOffset: number | null = null;
  if (first.month === 9) {
    startOffset = -(first.day - 1);
  } else {
    for (let i = 1; i <= 400; i++) {
      const h = hijriParts(at(i));
      if (h?.month === 9 && h.day === 1) {
        startOffset = i;
        break;
      }
    }
  }
  if (startOffset === null) return null;
  let length = 29;
  if (hijriParts(at(startOffset + 29))?.month === 9) length = 30;
  const start = at(startOffset);
  const year = hijriParts(start)?.year ?? 0;
  return {
    start,
    end: at(startOffset + length - 1),
    year,
    day: first.month === 9 ? first.day : null,
    daysUntil: Math.max(0, startOffset),
  };
}
