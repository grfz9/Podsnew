import { useId, type CSSProperties } from 'react';
import { AudioLines } from 'lucide-react';
import { GENRES, isReligiousGenre, primaryGenreId } from '../api/genres';
import { useCustomImagesOptional } from '../store/customImages';
import { useModerationOptional } from '../store/moderation';
import { genreIcon } from './GenreTile';

/**
 * Couvertures générées : aucune image de podcast n'est affichée (beaucoup de pochettes représentent
 * des personnes), et aucune image n'est produite par IA. Tout est dessiné ici, en géométrie pure :
 * - Coran : arche de mihrab dorée sur fond vert-bleu ;
 * - podcasts islamiques : pavage d'étoiles à huit branches et rosace (ou arche), palettes variées ;
 * - autres podcasts : monogramme (initiales du titre) sur un dégradé de la couleur de sa catégorie,
 *   avec un motif et une nuance propres à chaque podcast.
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

/** Mots ignorés pour les initiales (articles, liaisons). */
const SMALL_WORDS = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'en', 'au', 'aux', 'à', 'dans', 'sur', 'pour', 'avec', 'par', 'the', 'a', 'an', 'of', 'and', 'podcast']);

/**
 * Initiales d'un titre de podcast : « Les Grosses Têtes » → « GT », « L'After Foot » → « AF »,
 * « LEGEND » → « Le », « C dans l'air » → « CA », « UNBX » → « UNBX ». Quatre lettres au plus.
 */
export function monogram(title: string): string {
  const words = title
    .replace(/(,|\s[-–—|:(]).*$/, '') // on ignore le sous-titre (« HugoDécrypte - Actus du jour », « UNBX, le podcast… »)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((w) => !SMALL_WORDS.has(w.toLowerCase()));
  const picked = meaningful.length ? meaningful : words;
  if (!picked.length) return '•';
  if (picked.length === 1) {
    const w = picked[0];
    // Sigle court en capitales (UNBX, RTL) : gardé en entier.
    if (w.length <= 4 && w === w.toUpperCase()) return w;
    // Mot en « CamelCase » (HugoDécrypte) : une lettre par partie.
    const caps = w.match(/[A-Z0-9]/g);
    if (caps && caps.length >= 2 && caps.length <= 3 && w !== w.toUpperCase()) return caps.join('');
    return w.slice(0, 1).toUpperCase() + w.slice(1, 2).toLowerCase();
  }
  return picked
    .slice(0, picked.length >= 3 && picked[2].length > 2 ? 3 : 2)
    .map((w) => w[0].toUpperCase())
    .join('');
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

const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360} ${Math.max(0, Math.min(100, s))}% ${Math.max(0, Math.min(100, l))}%)`;

/** Motifs de fond (discrets) : chaque podcast en reçoit un, placé et orienté selon son titre. */
function Pattern({ variant, seed }: { variant: number; seed: number }) {
  const flip = seed % 2 === 0;
  const corner = flip ? 100 : 0;
  switch (variant) {
    case 0:
      return <>{[18, 30, 42, 54, 66, 78].map((r) => <circle key={r} cx={corner} cy="100" r={r} />)}</>;
    case 1:
      return <>{[0, 12, 24, 36, 48, 60, 72, 84, 96, 108].map((x) => <line key={x} x1={x - 30} y1={flip ? 100 : 0} x2={x + 30} y2={flip ? 0 : 100} />)}</>;
    case 2:
      return <path d={starPath(flip ? 78 : 22, 22, 30, 21)} />;
    case 3:
      return (
        <>
          {Array.from({ length: 36 }, (_, i) => (
            <circle key={i} cx={8 + (i % 6) * 17} cy={8 + Math.floor(i / 6) * 17} r="1.6" fill="#fff" stroke="none" />
          ))}
        </>
      );
    case 4:
      return <>{[20, 36, 52, 68, 84].map((y) => <path key={y} d={`M0 ${y} Q25 ${y - 10} 50 ${y} T100 ${y}`} />)}</>;
    case 5:
      return <>{[14, 26, 38, 50].map((r) => <rect key={r} x={50 - r} y={50 - r} width={r * 2} height={r * 2} rx="4" transform={`rotate(${flip ? 12 : -12} 50 50)`} />)}</>;
    default:
      return <path d={`M${flip ? 10 : 20} 100 V62 C${flip ? 10 : 20} 38 34 22 50 12 C66 22 ${flip ? 90 : 80} 38 ${flip ? 90 : 80} 62 V100`} />;
  }
}

const PATTERN_COUNT = 7;

function GeneralArt({ id, color, seed, title, Badge }: { id: string; color: string; seed: number; title: string; Badge?: typeof AudioLines }) {
  // Teinte de la catégorie, décalée et éclaircie ou assombrie selon le titre : deux podcasts
  // de la même catégorie restent de la même famille de couleur sans être identiques.
  const [h, s, l] = hexToHsl(color);
  const hue = h + ((seed % 9) - 4) * 4;
  const light = l + (((seed >> 4) % 5) - 2) * 4;
  const from = hsl(hue, s, light + 6);
  const to = hsl(hue + (seed % 2 ? 18 : -18), s * 0.9, light - 12);
  const text = monogram(title);
  const angle = (seed >> 6) % 4;
  const [x1, y1, x2, y2] = [
    [0, 0, 1, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0.5, 0, 0.5, 1],
  ][angle];
  return (
    <svg className="cover__art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      <g fill="none" stroke="#fff" strokeOpacity="0.13" strokeWidth="1" opacity={0.9}>
        <Pattern variant={(seed >> 3) % PATTERN_COUNT} seed={seed} />
      </g>
      <text
        className="cover__monogram"
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={[48, 48, 38, 30, 24][Math.min(text.length, 4)]}
      >
        {text}
      </text>
      {Badge && <Badge x="76" y="76" width="16" height="16" strokeWidth={1.8} className="cover__badge" />}
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
  const Icon = genreId ? genreIcon(genreId) : AudioLines;
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
        <GeneralArt id={id} color={genreColor} seed={seed} title={alt} Badge={size && size < 72 ? undefined : Icon} />
      )}
    </div>
  );
}
