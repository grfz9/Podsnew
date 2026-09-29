import type { Genre } from '../types';

/** Catégories de podcasts Apple (identifiants officiels). */
export const GENRES: Genre[] = [
  { id: 1489, name: 'Actualités', color: '#e8115b' },
  { id: 1303, name: 'Humour', color: '#f59b23' },
  { id: 1324, name: 'Société & culture', color: '#8d67ab' },
  { id: 1487, name: 'Histoire', color: '#a56752' },
  { id: 1488, name: 'Faits divers', color: '#5f1e1e' },
  { id: 1533, name: 'Sciences', color: '#1e3264' },
  { id: 1318, name: 'Technologie', color: '#477d95' },
  { id: 1321, name: 'Économie & business', color: '#27856a' },
  { id: 1304, name: 'Éducation', color: '#0d73ec' },
  { id: 1545, name: 'Sport', color: '#e1118c' },
  { id: 1512, name: 'Santé & bien-être', color: '#148a08' },
  { id: 1301, name: 'Arts', color: '#b49bc8' },
  { id: 1483, name: 'Fiction', color: '#503750' },
  { id: 1309, name: 'Cinéma & séries', color: '#dc148c' },
  { id: 1310, name: 'Musique', color: '#1db954' },
  { id: 1305, name: 'Enfants & famille', color: '#ff4632' },
  { id: 1502, name: 'Loisirs', color: '#777777' },
  { id: 1314, name: 'Religion & spiritualité', color: '#608108' },
];

export function getGenre(id: number): Genre | undefined {
  return GENRES.find((g) => g.id === id);
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
