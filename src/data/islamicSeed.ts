import type { Podcast } from '../types';

/**
 * Liste de départ des podcasts islamiques validés (Coran et Sunnah, selon la compréhension des pieux prédécesseurs).
 *
 * Cette liste est choisie par l'administrateur de Podsal : aucun podcast n'y est ajouté automatiquement.
 * - Podcast présent sur Apple Podcasts : son identifiant est le nombre à la fin de son adresse,
 *   par exemple https://podcasts.apple.com/fr/podcast/nom/id1234567890 → '1234567890'.
 * - Podcast absent d'Apple Podcasts : on indique l'adresse de son flux RSS (`feedUrl`) ; l'identifiant
 *   est alors « rss- » suivi de l'empreinte de cette adresse (voir rssPodcastId dans src/api/rss.ts).
 *   Le plus simple est de l'ajouter depuis la page « Modération » → « Ajouter » → « Par flux RSS ».
 *
 * Pour retirer un podcast de cette liste sans modifier le code : page « Modération » → « Validés » → « Masquer ».
 */
export const ISLAMIC_SEED: Pick<Podcast, 'id' | 'title' | 'author' | 'feedUrl'>[] = [
  // Cours d'étudiants en science et de savants de la Sunnah (Apple Podcasts, Spotify).
  { id: '1802887942', title: 'Le minhaj as-Salafiyah', author: 'Cours et conférences' },
  // Khoutbas du vendredi traduites en français – imam Younes (Abu Zakariya), mihraby.com.
  {
    id: 'rss-8980a14f66a551ea',
    title: 'Khoutbas – Mihraby',
    author: 'Imam Younes (Abu Zakariya)',
    feedUrl: 'https://feeds.buzzsprout.com/2392576.rss',
  },
];
