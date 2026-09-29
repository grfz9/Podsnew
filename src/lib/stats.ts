import type { DayStats, DeviceStats, PodcastMeta } from '../types';

export function emptyDeviceStats(): DeviceStats {
  return { updatedAt: 0, days: {}, podcasts: {}, hours: Array(24).fill(0) };
}

/** Clé de jour en heure locale : "2026-09-29". */
export function dayKey(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function getDay(stats: DeviceStats, key: string): DayStats {
  return stats.days[key] ?? { s: 0, p: {}, c: 0 };
}

/** Ajoute du temps d'écoute réel (en secondes) pour un podcast. */
export function addListening(
  stats: DeviceStats,
  podcastId: string,
  meta: PodcastMeta,
  seconds: number,
  at: Date = new Date(),
): DeviceStats {
  if (seconds <= 0) return stats;
  const key = dayKey(at);
  const day = getDay(stats, key);
  const hours = stats.hours.length === 24 ? [...stats.hours] : Array(24).fill(0);
  hours[at.getHours()] += seconds;
  return {
    updatedAt: Date.now(),
    days: { ...stats.days, [key]: { ...day, s: day.s + seconds, p: { ...day.p, [podcastId]: (day.p[podcastId] ?? 0) + seconds } } },
    podcasts: { ...stats.podcasts, [podcastId]: meta },
    hours,
  };
}

export function addCompletion(stats: DeviceStats, at: Date = new Date()): DeviceStats {
  const key = dayKey(at);
  const day = getDay(stats, key);
  return { ...stats, updatedAt: Date.now(), days: { ...stats.days, [key]: { ...day, c: day.c + 1 } } };
}

export interface Ranked<T> {
  item: T;
  seconds: number;
}

export interface StatsSummary {
  totalSeconds: number;
  completed: number;
  activeDays: number;
  podcasts: Ranked<{ id: string } & PodcastMeta>[];
  genres: Ranked<string>[];
  /** Secondes par mois (index 0 = janvier) pour l'année demandée. */
  byMonth: number[];
  /** Secondes par jour de l'intervalle, dans l'ordre chronologique. */
  byDay: { day: string; seconds: number }[];
  hours: number[];
  currentStreak: number;
  bestStreak: number;
}

export interface Period {
  /** Inclus, format "AAAA-MM-JJ". */
  from?: string;
  /** Inclus, format "AAAA-MM-JJ". */
  to?: string;
}

/** Fusionne les jours de tous les appareils. */
export function mergedDays(devices: Record<string, DeviceStats>): Record<string, DayStats> {
  const out: Record<string, DayStats> = {};
  for (const device of Object.values(devices)) {
    for (const [key, day] of Object.entries(device.days)) {
      const acc = (out[key] ??= { s: 0, p: {}, c: 0 });
      acc.s += day.s;
      acc.c += day.c;
      for (const [id, s] of Object.entries(day.p)) acc.p[id] = (acc.p[id] ?? 0) + s;
    }
  }
  return out;
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** Série de jours consécutifs avec au moins une minute d'écoute. */
export function streaks(days: Record<string, DayStats>, today: string = dayKey()): { current: number; best: number } {
  const active = new Set(Object.entries(days).filter(([, d]) => d.s >= 60).map(([k]) => k));
  let current = 0;
  // La série reste valable si l'on n'a pas encore écouté aujourd'hui.
  let cursor = active.has(today) ? today : previousDay(today);
  while (active.has(cursor)) {
    current++;
    cursor = previousDay(cursor);
  }
  let best = 0;
  for (const key of active) {
    if (active.has(previousDay(key))) continue; // pas un début de série
    let length = 0;
    let k = key;
    while (active.has(k)) {
      length++;
      const [y, m, d] = k.split('-').map(Number);
      k = dayKey(new Date(y, m - 1, d + 1));
    }
    best = Math.max(best, length);
  }
  return { current, best: Math.max(best, current) };
}

export function summarize(devices: Record<string, DeviceStats>, period: Period = {}, today: string = dayKey()): StatsSummary {
  const all = mergedDays(devices);
  const inPeriod = Object.entries(all)
    .filter(([k]) => (!period.from || k >= period.from) && (!period.to || k <= period.to))
    .sort(([a], [b]) => a.localeCompare(b));

  const meta: Record<string, PodcastMeta> = {};
  const hours = Array(24).fill(0) as number[];
  for (const device of Object.values(devices)) {
    Object.assign(meta, device.podcasts);
    device.hours?.forEach((s, h) => (hours[h] += s));
  }

  const perPodcast: Record<string, number> = {};
  const byMonth = Array(12).fill(0) as number[];
  let totalSeconds = 0;
  let completed = 0;
  for (const [key, day] of inPeriod) {
    totalSeconds += day.s;
    completed += day.c;
    byMonth[Number(key.slice(5, 7)) - 1] += day.s;
    for (const [id, s] of Object.entries(day.p)) perPodcast[id] = (perPodcast[id] ?? 0) + s;
  }

  const podcasts = Object.entries(perPodcast)
    .map(([id, seconds]) => ({ item: { id, ...(meta[id] ?? { title: 'Podcast', artwork: '' }) }, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const perGenre: Record<string, number> = {};
  for (const p of podcasts) {
    const genre = p.item.genre || 'Autres';
    perGenre[genre] = (perGenre[genre] ?? 0) + p.seconds;
  }
  const genres = Object.entries(perGenre)
    .map(([item, seconds]) => ({ item, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  const { current, best } = streaks(all, today);
  return {
    totalSeconds,
    completed,
    activeDays: inPeriod.filter(([, d]) => d.s >= 60).length,
    podcasts,
    genres,
    byMonth,
    byDay: inPeriod.map(([day, d]) => ({ day, seconds: d.s })),
    hours,
    currentStreak: current,
    bestStreak: best,
  };
}
