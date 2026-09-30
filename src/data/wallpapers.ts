/**
 * Fonds d'écran : uniquement de la géométrie, de l'architecture et des paysages
 * (aucun être vivant, aucune image produite par IA, aucun verset en décor).
 * Chaque fond est un arrière-plan CSS assez sombre pour que le texte reste lisible.
 */
export interface Wallpaper {
  id: string;
  name: string;
  premium: boolean;
  /** Valeur de la propriété CSS `background`. */
  background: string;
}

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

/** Étoile à huit branches (16 sommets). */
function star(cx: number, cy: number, outer: number, inner: number): string {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return pts.join(' ');
}

/** Voile sombre pour la lisibilité (du plus clair en haut au plus sombre en bas). */
export const veil = (top: number, bottom: number) => `linear-gradient(180deg, rgba(8,11,11,${top}), rgba(8,11,11,${bottom}))`;

const STARS_FIELD = svg(
  Array.from({ length: 70 }, (_, i) => {
    const x = (i * 137.5) % 600;
    const y = (i * 71.3) % 600;
    const r = i % 7 === 0 ? 1.4 : i % 3 === 0 ? 0.9 : 0.6;
    return `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${r}' fill='white' opacity='${i % 5 === 0 ? 0.8 : 0.45}'/>`;
  }).join(''),
  600,
  600,
);

const CRESCENT = svg(`<path d='M60 10a50 50 0 1 0 0 100a40 40 0 1 1 0-100z' fill='%23f1e3bd' opacity='0.85'/>`.replace('%23', '#'), 120, 120);

const DUNES = svg(
  `<path d='M0 150 C200 90 380 170 600 110 C780 60 900 130 1200 90 V300 H0Z' fill='#5a3d24' opacity='0.55'/>` +
    `<path d='M0 210 C260 150 460 240 700 180 C900 130 1040 200 1200 170 V300 H0Z' fill='#3b2717' opacity='0.8'/>`,
  1200,
  300,
);

const GIRIH = svg(
  `<g fill='none' stroke='#d8b76e' stroke-width='1' opacity='0.35'>` +
    `<polygon points='${star(40, 40, 22, 16)}'/>` +
    `<polygon points='${star(0, 0, 10, 7)}'/><polygon points='${star(80, 0, 10, 7)}'/><polygon points='${star(0, 80, 10, 7)}'/><polygon points='${star(80, 80, 10, 7)}'/>` +
    `<path d='M40 18 L40 0 M40 62 L40 80 M18 40 L0 40 M62 40 L80 40'/></g>`,
  80,
  80,
);

const ARCADES = svg(
  Array.from({ length: 6 }, (_, i) => {
    const x = i * 200;
    return (
      `<path d='M${x + 20} 400 V210 C${x + 20} 150 ${x + 60} 110 ${x + 100} 80 C${x + 140} 110 ${x + 180} 150 ${x + 180} 210 V400' fill='none' stroke='#d8b76e' stroke-width='3' opacity='0.35'/>` +
      `<path d='M${x + 40} 400 V220 C${x + 40} 172 ${x + 70} 138 ${x + 100} 114 C${x + 130} 138 ${x + 160} 172 ${x + 160} 220 V400' fill='#0b1414' opacity='0.5'/>`
    );
  }).join(''),
  1200,
  400,
);

const SKYLINE = svg(
  // Coupole et minarets (architecture), au bas de l'écran.
  `<g fill='#0a1512'>` +
    `<rect x='0' y='330' width='1200' height='70'/>` +
    `<path d='M470 330 V260 C470 190 530 150 600 140 C670 150 730 190 730 260 V330Z'/>` +
    `<rect x='592' y='110' width='16' height='34'/><circle cx='600' cy='104' r='7'/>` +
    `<rect x='360' y='170' width='26' height='160'/><path d='M356 170 L373 128 L390 170Z'/>` +
    `<rect x='814' y='170' width='26' height='160'/><path d='M810 170 L827 128 L844 170Z'/>` +
    `<path d='M160 330 V290 C160 262 186 246 214 244 C242 246 268 262 268 290 V330Z'/>` +
    `<path d='M932 330 V290 C932 262 958 246 986 244 C1014 246 1040 262 1040 290 V330Z'/>` +
    `</g>`,
  1200,
  400,
);

const ZELLIGE = svg(
  `<rect width='60' height='60' fill='#0e1a1a'/>` +
    `<polygon points='${star(30, 30, 16, 11)}' fill='#1f5f73' opacity='0.8'/>` +
    `<polygon points='${star(30, 30, 7, 5)}' fill='#c9a24f' opacity='0.85'/>` +
    `<polygon points='${star(0, 0, 9, 6)}' fill='#2f6b4f'/><polygon points='${star(60, 0, 9, 6)}' fill='#2f6b4f'/>` +
    `<polygon points='${star(0, 60, 9, 6)}' fill='#2f6b4f'/><polygon points='${star(60, 60, 9, 6)}' fill='#2f6b4f'/>`,
  60,
  60,
);

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'halo',
    name: 'Vert-bleu',
    premium: false,
    background:
      'radial-gradient(900px 360px at 12% -120px, rgba(47,79,79,0.55), transparent 70%), radial-gradient(700px 300px at 95% -160px, rgba(47,79,79,0.3), transparent 70%), #0d1111',
  },
  {
    id: 'nuit',
    name: 'Nuit étoilée',
    premium: false,
    background: `${CRESCENT} right 8% top 6% / 90px no-repeat, ${STARS_FIELD} 0 0 / 600px 600px repeat, radial-gradient(120% 80% at 50% 0%, #13253a, #070b12 70%)`,
  },
  {
    id: 'sable',
    name: 'Dunes',
    premium: false,
    background: `${veil(0.2, 0.45)}, ${DUNES} center bottom / 100% auto no-repeat, linear-gradient(180deg, #1d140d, #2b1d12 60%, #1a120b)`,
  },
  {
    id: 'girih',
    name: 'Étoiles dorées',
    premium: true,
    background: `${veil(0.35, 0.6)}, ${GIRIH} 0 0 / 80px 80px repeat, radial-gradient(120% 90% at 50% 0%, #1c3434, #0a1414 75%)`,
  },
  {
    id: 'arcades',
    name: 'Arcades',
    premium: true,
    background: `${veil(0.1, 0.35)}, ${ARCADES} center bottom / 100% auto no-repeat, linear-gradient(180deg, #0c1616, #132626 70%, #0b1515)`,
  },
  {
    id: 'medina',
    name: 'Coupole au crépuscule',
    premium: true,
    background: `${SKYLINE} center bottom / 100% auto no-repeat, ${STARS_FIELD} 0 0 / 600px 600px repeat, linear-gradient(180deg, #0a1a1c 0%, #16302f 55%, #3a3a26 85%, #4a3b22 100%)`,
  },
  {
    id: 'fajr',
    name: 'Aube (Fajr)',
    premium: true,
    background: `${veil(0.05, 0.25)}, linear-gradient(180deg, #081418 0%, #10302f 45%, #3c4a33 75%, #7a5a2c 100%)`,
  },
  {
    id: 'zellige',
    name: 'Zellige',
    premium: true,
    background: `${veil(0.55, 0.75)}, ${ZELLIGE} 0 0 / 60px 60px repeat, #0e1a1a`,
  },
];

export const DEFAULT_WALLPAPER = WALLPAPERS[0];

export function getWallpaper(id: string | undefined): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? DEFAULT_WALLPAPER;
}

/** Image importée par l'utilisateur (Podsal+), pour le fond principal comme pour le menu. */
export const CUSTOM_WALLPAPER_ID = 'custom';

export function customBackground(url: string): string {
  return `${veil(0.35, 0.6)}, url("${url}") center / cover no-repeat, #0d1111`;
}

/**
 * Menu de gauche : couleur d'origine, quelques teintes unies propres au menu (gratuites),
 * puis les mêmes fonds que la page (gratuits et Podsal+).
 */
export const SIDEBAR_DEFAULT: Wallpaper = { id: 'uni', name: 'Uni', premium: false, background: '#090c0c' };
export const SIDEBAR_WALLPAPERS: Wallpaper[] = [
  SIDEBAR_DEFAULT,
  { id: 'foret', name: 'Vert profond', premium: false, background: 'linear-gradient(180deg, #17403a 0%, #0e2723 55%, #091614 100%)' },
  { id: 'ocean', name: 'Bleu nuit', premium: false, background: 'linear-gradient(180deg, #17304f 0%, #0d1c31 55%, #080f1b 100%)' },
  { id: 'terre', name: 'Terre', premium: false, background: 'linear-gradient(180deg, #46301d 0%, #291c11 55%, #170f09 100%)' },
  ...WALLPAPERS,
];

/** Voile léger dans le menu : le texte y est petit et doit rester lisible. */
export function sidebarBackground(background: string): string {
  return `linear-gradient(180deg, rgba(9,12,12,0.25), rgba(9,12,12,0.55)), ${background}`;
}

/**
 * Fond à afficher selon le réglage et l'abonnement : un fond Podsal+ ou une image importée
 * reviennent au fond par défaut quand l'abonnement prend fin.
 */
export function resolveBackground(
  slot: 'main' | 'sidebar',
  settingId: string | undefined,
  isPremium: boolean,
  customUrl: string | undefined,
): { id: string; background: string } {
  const fallback = slot === 'main' ? DEFAULT_WALLPAPER : SIDEBAR_DEFAULT;
  if (settingId === CUSTOM_WALLPAPER_ID) {
    return isPremium && customUrl ? { id: CUSTOM_WALLPAPER_ID, background: customBackground(customUrl) } : fallback;
  }
  const list = slot === 'main' ? WALLPAPERS : SIDEBAR_WALLPAPERS;
  const chosen = list.find((w) => w.id === settingId) ?? fallback;
  return chosen.premium && !isPremium ? fallback : chosen;
}
