import { useId, type CSSProperties, type ReactElement } from 'react';
import { GENRES, isReligiousGenre, primaryGenreId } from '../api/genres';
import { useCustomImagesOptional } from '../store/customImages';
import { useModerationOptional } from '../store/moderation';

/**
 * Couvertures générées : aucune image de podcast n'est affichée (beaucoup de pochettes représentent
 * des personnes), et aucune image n'est produite par IA. Tout est dessiné ici, en géométrie pure :
 * - Coran : arche de mihrab dorée sur fond vert-bleu ;
 * - podcasts islamiques : pavage d'étoiles à huit branches et rosace (ou arche), palettes variées ;
 * - autres podcasts : composition abstraite (formes géométriques, paysage stylisé) dans la teinte
 *   de sa catégorie, propre à chaque podcast.
 * Le dessin dépend du titre : un même podcast garde toujours la même couverture.
 * Avec Podsal+, l'utilisateur peut remplacer la couverture par une image de son choix.
 */

export type CoverKind = 'podcast' | 'quran' | 'islamic';

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Étoile à huit branches (16 sommets) centrée en (cx, cy). */
export function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join('L')}Z`;
}

/** Palettes des couvertures islamiques : fond, fond sombre, ornement. */
const ISLAMIC_PALETTES: [string, string, string][] = [
  ['#2f4f4f', '#1a3030', '#e2c485'],
  ['#1f5f46', '#113a2b', '#e8d29a'],
  ['#1e3a5f', '#10223a', '#d9b870'],
  ['#5c2a2a', '#361717', '#e6c78a'],
  ['#6b5a3a', '#3d3220', '#f0ddb0'],
  ['#234b5a', '#132b34', '#cfe3dc'],
];

/** Couleurs de secours pour un podcast sans catégorie connue (tons sobres, sans violet). */
const FALLBACK_COLORS = ['#0f5f73', '#1e3a8a', '#6b4f2a', '#4d6b1f', '#334155', '#7a2e2e', '#8a6d1f', '#23523a', '#3f4f5f'];

const ARCH = 'M22 90 V52 C22 34 36 22 50 11 C64 22 78 34 78 52 V90';

function QuranArt({ id }: { id: string }) {
  const gold = '#e2c485';
  return (
    <svg className="cover__art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <pattern id={`${id}-p`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d={starPath(10, 10, 6, 4.2)} fill="none" stroke={gold} strokeWidth="0.5" opacity="0.35" />
        </pattern>
        <radialGradient id={`${id}-g`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#406a6a" />
          <stop offset="1" stopColor="#1a3030" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      <rect width="100" height="100" fill={`url(#${id}-p)`} />
      <path d={ARCH} fill="#1a3030" fillOpacity="0.55" stroke={gold} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M30 90 V55 C30 41 40 31 50 23 C60 31 70 41 70 55 V90" fill="none" stroke={gold} strokeWidth="0.9" opacity="0.7" />
      <path d={starPath(50, 58, 13, 9.5)} fill={gold} />
      <path d={starPath(50, 58, 7, 5)} fill="#1a3030" />
    </svg>
  );
}

function IslamicArt({ id, seed }: { id: string; seed: number }) {
  const [bg, dark, orn] = ISLAMIC_PALETTES[seed % ISLAMIC_PALETTES.length];
  const variant = Math.floor(seed / ISLAMIC_PALETTES.length) % 3;
  const tile = [20, 25, 16][variant];
  const rotate = [0, 22.5, 45][Math.floor(seed / 7) % 3];
  return (
    <svg className="cover__art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <pattern id={`${id}-p`} width={tile} height={tile} patternUnits="userSpaceOnUse" patternTransform={`rotate(${rotate} 50 50)`}>
          <path d={starPath(tile / 2, tile / 2, tile * 0.34, tile * 0.24)} fill="none" stroke={orn} strokeWidth="0.6" />
          <path d={starPath(0, 0, tile * 0.18, tile * 0.12)} fill="none" stroke={orn} strokeWidth="0.5" />
          <path d={starPath(tile, 0, tile * 0.18, tile * 0.12)} fill="none" stroke={orn} strokeWidth="0.5" />
          <path d={starPath(0, tile, tile * 0.18, tile * 0.12)} fill="none" stroke={orn} strokeWidth="0.5" />
          <path d={starPath(tile, tile, tile * 0.18, tile * 0.12)} fill="none" stroke={orn} strokeWidth="0.5" />
        </pattern>
        <radialGradient id={`${id}-g`} cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor={bg} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      <rect width="100" height="100" fill={`url(#${id}-p)`} opacity="0.3" />
      {variant === 1 ? (
        <>
          <path d={ARCH} fill={dark} fillOpacity="0.6" stroke={orn} strokeWidth="2" strokeLinejoin="round" />
          <path d={starPath(50, 30, 5, 3.5)} fill={orn} />
          <g stroke={orn} strokeWidth="2.2" strokeLinecap="round">
            {[
              [38, 12],
              [44, 20],
              [50, 28],
              [56, 20],
              [62, 12],
            ].map(([x, h]) => (
              <line key={x} x1={x} y1={64 - h / 2} x2={x} y2={64 + h / 2} />
            ))}
          </g>
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="31" fill={dark} fillOpacity="0.55" stroke={orn} strokeWidth="0.8" />
          <path d={starPath(50, 50, 28, 20)} fill="none" stroke={orn} strokeWidth="1.8" strokeLinejoin="round" />
          <path d={starPath(50, 50, 18, 13)} fill={orn} fillOpacity="0.9" transform="rotate(22.5 50 50)" />
          <circle cx="50" cy="50" r="6" fill={dark} />
        </>
      )}
    </svg>
  );
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : un même podcast garde toujours le même dessin. */
function random(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(Math.max(0, Math.min(100, s)))}% ${Math.round(Math.max(0, Math.min(100, l)))}%)`;

interface Palette {
  bg: string;
  deep: string;
  mid: string;
  light: string;
  accent: string;
}

/** Couleurs d'une couverture : la teinte de la catégorie, décalée pour chaque podcast, plus une touche complémentaire. */
function makePalette(color: string, r: () => number): Palette {
  const [h, s, l] = hexToHsl(color);
  const hue = h + (r() - 0.5) * 36;
  const sat = Math.max(38, Math.min(82, s + (r() - 0.5) * 20));
  const base = Math.max(24, Math.min(46, l + (r() - 0.5) * 14));
  const dir = r() < 0.5 ? -1 : 1;
  return {
    bg: hsl(hue, sat, base),
    deep: hsl(hue + dir * 10, sat, base - 13),
    mid: hsl(hue + dir * 22, sat, base + 11),
    light: hsl(hue + dir * 34, sat * 0.85, Math.min(base + 32, 84)),
    accent: hsl(hue + 165 + r() * 30, sat * 0.75, Math.min(base + 26, 76)),
  };
}

const pick = <T,>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)];
const between = (r: () => number, min: number, max: number) => min + r() * (max - min);

/**
 * Compositions abstraites (inspirées du Bauhaus et des paysages) : aucune lettre, aucune personne.
 * Chaque podcast reçoit une composition, des positions, des tailles et des couleurs qui lui sont propres.
 */
const COMPOSITIONS: ((r: () => number, p: Palette) => ReactElement)[] = [
  // Bulles
  (r, p) => (
    <>
      <circle cx={between(r, 55, 90)} cy={between(r, 10, 40)} r={between(r, 26, 40)} fill={p.mid} />
      <circle cx={between(r, 5, 40)} cy={between(r, 60, 95)} r={between(r, 22, 34)} fill={p.deep} />
      <circle cx={between(r, 35, 65)} cy={between(r, 40, 65)} r={between(r, 10, 18)} fill={p.light} />
      <circle cx={between(r, 70, 90)} cy={between(r, 70, 90)} r={between(r, 4, 9)} fill={p.accent} />
    </>
  ),
  // Vagues et soleil
  (r, p) => {
    const y = between(r, 52, 66);
    const amp = between(r, 6, 14);
    return (
      <>
        <circle cx={between(r, 20, 80)} cy={between(r, 18, 34)} r={between(r, 10, 16)} fill={p.light} />
        <path d={`M0 ${y} Q25 ${y - amp} 50 ${y} T100 ${y} V100 H0Z`} fill={p.mid} />
        <path d={`M0 ${y + 14} Q25 ${y + 14 + amp} 50 ${y + 14} T100 ${y + 14} V100 H0Z`} fill={p.deep} />
        <path d={`M0 ${y + 28} Q25 ${y + 28 - amp} 50 ${y + 28} T100 ${y + 28} V100 H0Z`} fill={p.accent} opacity="0.85" />
      </>
    );
  },
  // Montagnes
  (r, p) => {
    const a = between(r, 20, 60);
    const b = between(r, 50, 85);
    const peak = between(r, 22, 34);
    return (
      <>
        <circle cx={between(r, 65, 88)} cy={between(r, 14, 26)} r={between(r, 7, 12)} fill={p.accent} />
        <polygon points={`-10,100 ${a},${peak} ${a + 60},100`} fill={p.mid} />
        <polygon points={`${b - 55},100 ${b},${between(r, 42, 58)} 110,100`} fill={p.deep} />
        <polygon points={`${a - 7},${peak + 9} ${a},${peak} ${a + 7},${peak + 9}`} fill={p.light} />
      </>
    );
  },
  // Anneaux
  (r, p) => {
    const cx = between(r, 30, 70);
    const cy = between(r, 30, 70);
    const colors = [p.deep, p.mid, p.light, p.accent];
    return (
      <>
        {[46, 34, 22, 11].map((radius, i) => (
          <circle key={radius} cx={cx} cy={cy} r={radius} fill={colors[i]} />
        ))}
      </>
    );
  },
  // Moitiés et disque
  (r, p) => {
    const vertical = r() < 0.5;
    const cut = between(r, 35, 65);
    const along = between(r, 30, 70);
    const cx = vertical ? cut : along;
    const cy = vertical ? along : cut;
    return (
      <>
        {vertical ? <rect x={cut} width={100 - cut} height="100" fill={p.deep} /> : <rect y={cut} width="100" height={100 - cut} fill={p.deep} />}
        <circle cx={cx} cy={cy} r={between(r, 22, 30)} fill={p.light} />
        <circle cx={cx} cy={cy} r={between(r, 7, 12)} fill={p.accent} />
      </>
    );
  },
  // Bandes diagonales
  (r, p) => {
    const angle = pick(r, [-35, -20, 20, 35]);
    const colors = [p.deep, p.mid, p.light, p.accent, p.mid];
    let x = -30;
    const bands = colors.map((c, i) => {
      const width = between(r, 10, 22);
      const band = <rect key={i} x={x} y="-40" width={width} height="180" fill={c} />;
      x += width + between(r, 4, 12);
      return band;
    });
    return <g transform={`rotate(${angle} 50 50)`}>{bands}</g>;
  },
  // Blocs (Bauhaus)
  (r, p) => {
    const colors = [p.deep, p.mid, p.light, p.accent];
    return (
      <>
        {[0, 1].flatMap((row) =>
          [0, 1].map((col) => {
            const c = pick(r, colors);
            const x = col * 50;
            const y = row * 50;
            const shape = Math.floor(r() * 3);
            const key = `${row}-${col}`;
            if (shape === 0) return <rect key={key} x={x + 6} y={y + 6} width="38" height="38" rx="6" fill={c} />;
            if (shape === 1) return <circle key={key} cx={x + 25} cy={y + 25} r="19" fill={c} />;
            return <path key={key} d={`M${x} ${y + 50} A50 50 0 0 1 ${x + 50} ${y} V${y + 50}Z`} fill={c} transform={`rotate(${pick(r, [0, 90, 180, 270])} ${x + 25} ${y + 25})`} />;
          }),
        )}
      </>
    );
  },
  // Arcs
  (r, p) => (
    <>
      <path d="M0 100 A100 100 0 0 1 100 0 V100Z" fill={p.deep} transform={`rotate(${pick(r, [0, 90, 180, 270])} 50 50)`} />
      <circle cx={pick(r, [0, 100])} cy={pick(r, [0, 100])} r={between(r, 38, 52)} fill={p.mid} />
      <circle cx={between(r, 35, 65)} cy={between(r, 35, 65)} r={between(r, 9, 15)} fill={p.light} />
      <rect x={between(r, 10, 70)} y={between(r, 70, 86)} width={between(r, 16, 28)} height="5" rx="2.5" fill={p.accent} />
    </>
  ),
];

function AbstractArt({ color, seed }: { color: string; seed: number }) {
  const r = random(seed);
  const palette = makePalette(color, r);
  const compose = COMPOSITIONS[Math.floor(r() * COMPOSITIONS.length)];
  return (
    <svg className="cover__art" viewBox="0 0 100 100" aria-hidden>
      <rect width="100" height="100" fill={palette.bg} />
      {compose(r, palette)}
    </svg>
  );
}

export function Artwork({
  alt,
  size,
  className = '',
  kind,
  podcastId,
  genre,
  genreIds,
}: {
  /** Ignoré : les pochettes d'origine ne sont jamais affichées. */
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  kind?: CoverKind;
  podcastId?: string;
  genre?: string;
  genreIds?: string[];
}) {
  const moderation = useModerationOptional();
  const customImages = useCustomImagesOptional();
  const custom = podcastId ? customImages?.coverUrl(podcastId) : undefined;
  const id = `cv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const seed = hash(podcastId ?? alt);
  const resolved: CoverKind =
    kind ??
    (podcastId?.startsWith('quran-')
      ? 'quran'
      : (podcastId && moderation?.isValidated(podcastId)) || isReligiousGenre(genre) || genreIds?.includes('1440')
        ? 'islamic'
        : 'podcast');
  const genreId = primaryGenreId({ genre, genreIds });
  const genreColor = GENRES.find((g) => g.id === genreId)?.color ?? FALLBACK_COLORS[seed % FALLBACK_COLORS.length];
  const style: CSSProperties = size ? { width: size, height: size } : {};
  if (custom) {
    return <img className={`artwork cover cover--custom ${className}`} style={style} src={custom} alt={alt} draggable={false} />;
  }
  return (
    <div className={`artwork cover cover--${resolved} ${className}`} style={style} role="img" aria-label={alt}>
      {resolved === 'quran' ? (
        <QuranArt id={id} />
      ) : resolved === 'islamic' ? (
        <IslamicArt id={id} seed={seed} />
      ) : (
        <AbstractArt color={genreColor} seed={seed} />
      )}
    </div>
  );
}
