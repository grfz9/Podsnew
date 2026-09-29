import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan';
import type { PrayerMethod, PrayerSettings } from '../store/library';

/** Horaires de prière calculés sur l'appareil (bibliothèque adhan-js), sans service en ligne. */

export const PRAYER_METHODS: { id: PrayerMethod; label: string }[] = [
  { id: 'mwl', label: 'Ligue islamique mondiale (Fajr 18°, Isha 17°)' },
  { id: 'ummalqura', label: 'Umm al-Qura, La Mecque' },
  { id: 'egypt', label: 'Autorité égyptienne (19,5° / 17,5°)' },
  { id: 'karachi', label: 'Université de Karachi (18° / 18°)' },
  { id: 'isna', label: 'ISNA, Amérique du Nord (15° / 15°)' },
  { id: 'moonsighting', label: 'Moonsighting Committee' },
  { id: 'fifteen', label: 'Angle de 15° (Fajr et Isha)' },
  { id: 'uoif', label: 'Angle de 12° (Fajr et Isha)' },
];

export const PRAYER_NAMES = {
  fajr: 'Fajr',
  sunrise: 'Lever du soleil',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
} as const;

export type PrayerKey = keyof typeof PRAYER_NAMES;

/** Les cinq prières (sans le lever du soleil). */
export const FIVE_PRAYERS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Quelques villes pour choisir rapidement un lieu sans géolocalisation. */
export const CITIES: { name: string; lat: number; lng: number }[] = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  { name: 'Nice', lat: 43.7102, lng: 7.262 },
  { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { name: 'Montpellier', lat: 43.6108, lng: 3.8767 },
  { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  { name: 'Rennes', lat: 48.1173, lng: -1.6778 },
  { name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
  { name: 'Bruxelles', lat: 50.8503, lng: 4.3517 },
  { name: 'Genève', lat: 46.2044, lng: 6.1432 },
  { name: 'Luxembourg', lat: 49.6116, lng: 6.1319 },
  { name: 'Montréal', lat: 45.5019, lng: -73.5674 },
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { name: 'Alger', lat: 36.7538, lng: 3.0588 },
  { name: 'Tunis', lat: 36.8065, lng: 10.1815 },
  { name: 'Dakar', lat: 14.7167, lng: -17.4677 },
  { name: 'La Mecque', lat: 21.3891, lng: 39.8579 },
  { name: 'Médine', lat: 24.5247, lng: 39.5692 },
];

export function calculationParameters(method: PrayerMethod, madhab: 'shafi' | 'hanafi', coordinates: Coordinates): CalculationParameters {
  let params: CalculationParameters;
  switch (method) {
    case 'ummalqura':
      params = CalculationMethod.UmmAlQura();
      break;
    case 'egypt':
      params = CalculationMethod.Egyptian();
      break;
    case 'karachi':
      params = CalculationMethod.Karachi();
      break;
    case 'isna':
      params = CalculationMethod.NorthAmerica();
      break;
    case 'moonsighting':
      params = CalculationMethod.MoonsightingCommittee();
      break;
    case 'fifteen':
      params = new CalculationParameters('Other', 15, 15);
      break;
    case 'uoif':
      params = new CalculationParameters('Other', 12, 12);
      break;
    default:
      params = CalculationMethod.MuslimWorldLeague();
  }
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  // Latitudes élevées (nord de l'Europe en été) : règle recommandée par adhan.
  params.highLatitudeRule = HighLatitudeRule.recommended(coordinates);
  return params;
}

export type DayTimes = Record<PrayerKey, Date>;

export function prayerTimes(settings: Pick<PrayerSettings, 'latitude' | 'longitude' | 'method' | 'madhab'>, date: Date = new Date()): DayTimes | null {
  if (settings.latitude === null || settings.longitude === null) return null;
  const coordinates = new Coordinates(settings.latitude, settings.longitude);
  const t = new PrayerTimes(coordinates, date, calculationParameters(settings.method, settings.madhab, coordinates));
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

/** Prochaine des cinq prières (éventuellement Fajr du lendemain). */
export function nextPrayer(
  settings: Pick<PrayerSettings, 'latitude' | 'longitude' | 'method' | 'madhab'>,
  now: Date = new Date(),
): { key: PrayerKey; time: Date } | null {
  const today = prayerTimes(settings, now);
  if (!today) return null;
  const upcoming = FIVE_PRAYERS.map((key) => ({ key, time: today[key] })).find((p) => p.time > now);
  if (upcoming) return upcoming;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t = prayerTimes(settings, tomorrow)!;
  return { key: 'fajr', time: t.fajr };
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `dans ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `dans ${h} h ${String(m).padStart(2, '0')}`;
}
