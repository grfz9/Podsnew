import type { Genre, Podcast } from '../types';

/**
 * Catégories de podcasts Apple (identifiants officiels).
 * La musique est volontairement absente : Podsnew est réservé à la parole.
 */
export const GENRES: Genre[] = [
  { id: 1489, name: 'Actualités', color: '#c8102e' },
  { id: 1303, name: 'Humour', color: '#d97706' },
  { id: 1324, name: 'Société & culture', color: '#9a3412' },
  { id: 1487, name: 'Histoire', color: '#8a5a44' },
  { id: 1488, name: 'Faits divers', color: '#5f1e1e' },
  { id: 1533, name: 'Sciences', color: '#1e3a8a' },
  { id: 1318, name: 'Technologie', color: '#0f5f73' },
  { id: 1321, name: 'Économie & business', color: '#166534' },
  { id: 1304, name: 'Éducation', color: '#1d4ed8' },
  { id: 1545, name: 'Sport', color: '#b91c1c' },
  { id: 1512, name: 'Santé & bien-être', color: '#15803d' },
  { id: 1301, name: 'Arts', color: '#a16207' },
  { id: 1483, name: 'Fiction', color: '#334155' },
  { id: 1309, name: 'Cinéma & séries', color: '#be123c' },
  { id: 1305, name: 'Enfants & famille', color: '#c2410c' },
  { id: 1502, name: 'Loisirs', color: '#57534e' },
  { id: 1314, name: 'Religion & spiritualité', color: '#4d7c0f' },
];

export function getGenre(id: number): Genre | undefined {
  return GENRES.find((g) => g.id === id);
}

/** Musique (1310) et ses sous-catégories : commentaire, histoire, interviews. */
const MUSIC_GENRE_IDS = new Set(['1310', '1523', '1524', '1525']);
const MUSIC_NAME = /\bmusi(c|que)\b/i;

export function isMusicGenre(idOrName: string | number | undefined): boolean {
  if (idOrName === undefined) return false;
  const value = String(idOrName);
  return MUSIC_GENRE_IDS.has(value) || MUSIC_NAME.test(value);
}

/** Vrai si le podcast relève de la musique : il est alors exclu de l'application. */
export function isMusicPodcast(podcast: Pick<Podcast, 'genre' | 'genreIds'>): boolean {
  if (podcast.genreIds?.some((id) => MUSIC_GENRE_IDS.has(id))) return true;
  return isMusicGenre(podcast.genre);
}

/** Retrouve l'identifiant de catégorie d'un podcast (pour les recommandations). */
export function primaryGenreId(podcast: Pick<Podcast, 'genre' | 'genreIds'>): number | undefined {
  const known = new Set(GENRES.map((g) => String(g.id)));
  const fromIds = podcast.genreIds?.find((id) => known.has(id));
  if (fromIds) return Number(fromIds);
  if (!podcast.genre) return undefined;
  const name = podcast.genre.toLowerCase();
  return GENRES.find((g) => name.includes(g.name.toLowerCase().split(' ')[0]))?.id;
}

export const COUNTRIES = [
  { code: 'fr', name: 'France' },
  { code: 'be', name: 'Belgique' },
  { code: 'ch', name: 'Suisse' },
  { code: 'ca', name: 'Canada' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'us', name: 'États-Unis' },
  { code: 'gb', name: 'Royaume-Uni' },
];
