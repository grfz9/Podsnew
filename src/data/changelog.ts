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
    id: '2026-10-06',
    date: '6 octobre 2026',
    title: 'Partage, plan de lecture, Ramadan, Qibla et plus',
    items: [
      'Partagez un verset en belle image (WhatsApp, Instagram…) depuis la lecture ou le verset du jour.',
      'Plan de lecture : finissez le Coran en 30, 60 ou 90 jours, avant ou pendant le Ramadan, page après page.',
      'Page Ramadan : compte à rebours, fin du suhoor et iftar en direct pendant le mois.',
      'Boussole de la Qibla, depuis Prière ou « Moi ».',
      'Mode mémorisation : texte masqué, premier mot en indice, et répétition d’un verset à l’écoute.',
      'Recherche d’un mot dans tout le Coran, en français ou en arabe, même hors-ligne.',
    ],
  },
  {
    id: '2026-10-05b',
    date: '5 octobre 2026',
    title: 'Écoute plus fiable sur iPhone',
    items: [
      'L’écoute ne devrait plus se couper quand l’écran s’éteint.',
      'Si l’iPhone interrompt quand même la lecture, le bouton lecture (dans l’appli ou sur l’écran verrouillé) la relance là où elle s’était arrêtée.',
    ],
  },
  {
    id: '2026-10-05',
    date: '5 octobre 2026',
    title: 'Podsal devient 100 % islamique',
    items: [
      'Seuls le Coran et les podcasts islamiques vérifiés par la modération sont proposés.',
      'Les podcasts généraux (populaires, catégories, recommandations) sont retirés de l’accueil et de la recherche.',
      'La recherche trouve les récitateurs du Coran et les podcasts islamiques.',
      'Les podcasts du Studio apparaissent après validation par la modération.',
    ],
  },
  {
    id: '2026-10-04c',
    date: '4 octobre 2026',
    title: 'Verset du jour',
    items: [
      'Un verset du jour, différent pour chacun, sur l’accueil et dans « Lire le Coran ».',
      'Traduction de Muhammad Hamidullah (édition du Complexe du Roi Fahd) proposée par défaut.',
      'Podsal ne traduit jamais le Coran lui-même : seules des traductions officielles revues par des savants sont affichées.',
      'Pour comprendre et expliquer les versets, il est fortement conseillé de se tourner vers un savant.',
    ],
  },
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
