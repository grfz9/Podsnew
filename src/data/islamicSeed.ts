import type { Podcast } from '../types';

/**
 * Liste de départ des podcasts islamiques validés (Coran et Sunnah, selon la compréhension des pieux prédécesseurs).
 *
 * Cette liste est choisie par l'administrateur de Podsal : aucun podcast n'y est ajouté automatiquement.
 * Pour ajouter un podcast, il suffit de connaître son identifiant Apple Podcasts : c'est le nombre
 * à la fin de son adresse, par exemple https://podcasts.apple.com/fr/podcast/nom/id1234567890 → '1234567890'.
 *
 * Avec les comptes activés, la page « Modération » permet aussi de valider des podcasts sans modifier ce fichier.
 */
export const ISLAMIC_SEED: Pick<Podcast, 'id' | 'title' | 'author'>[] = [
  // { id: '1234567890', title: 'Nom du podcast', author: 'Nom du prédicateur' },
];
