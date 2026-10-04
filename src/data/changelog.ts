/**
 * Notes de version affichées une fois après chaque mise à jour (fenêtre « Quoi de neuf »)
 * et depuis « Moi ». La plus récente en premier ; ajouter une entrée à chaque nouveauté visible.
 */
export interface ChangelogEntry {
  /** Identifiant unique, dans l'ordre chronologique (date + lettre si plusieurs le même jour). */
  id: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-10-04b',
    date: '4 octobre 2026',
    title: 'Lire le Coran',
    items: [
      'Nouvel onglet « Lire le Coran » : les 114 sourates en arabe, avec la traduction de votre choix.',
      'Trois affichages : arabe et traduction, arabe seul façon mushaf, ou traduction seule.',
      'Taille du texte réglable, marque-pages et « Reprendre la lecture » là où vous vous étiez arrêté, sur tous vos appareils.',
      'Touchez un verset pour le marquer ou le copier, et « Écouter » pour lancer la récitation.',
    ],
  },
  {
    id: '2026-10-04',
    date: '4 octobre 2026',
    title: 'Une appli plus propre sur ordinateur',
    items: [
      'Fenêtre étroite : le menu devient une barre d’icônes, comme Discord ou Spotify.',
      'Fenêtre basse : le menu défile, plus rien n’est coupé.',
      'Barres de défilement plus discrètes et raccourcis de l’accueil qui passent à la ligne.',
      'Cette fenêtre « Quoi de neuf » après chaque mise à jour.',
      'Podsal+ affiché TVA comprise : 24,99 € par an ou 2,99 € par mois.',
    ],
  },
  {
    id: '2026-10-03b',
    date: '3 octobre 2026',
    title: 'Podsal sur ordinateur',
    items: [
      'Appli pour Windows, Mac et Linux, à télécharger sur podsal.com/telecharger.',
      'Elle se met à jour toute seule et garde votre connexion.',
      'Vos récitateurs favoris et vos réglages du Coran vous suivent sur tous vos appareils.',
    ],
  },
  {
    id: '2026-10-03a',
    date: '3 octobre 2026',
    title: 'Un lien pour installer Podsal',
    items: ['podsal.com/telecharger montre comment installer Podsal sur iPhone, Android ou ordinateur, avec un QR code et un bouton de partage.'],
  },
];
