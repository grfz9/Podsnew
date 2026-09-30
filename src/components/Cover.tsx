import { useId, type CSSProperties } from 'react';
import { AudioLines } from 'lucide-react';
import { GENRES, isReligiousGenre, primaryGenreId } from '../api/genres';
import { useModerationOptional } from '../store/moderation';
import { genreIcon } from './GenreTile';

/**
 * Couvertures générées : aucune image de podcast n'est affichée (beaucoup de pochettes représentent
 * des personnes), et aucune image n'est produite par IA. Tout est dessiné ici, en géométrie pure :
 * - Coran : arche de mihrab dorée sur fond vert-bleu ;
 * - podcasts islamiques : pavage d'étoiles à huit branches et rosace (ou arche), palettes variées ;
 * - autres podcasts : icône de la catégorie sur sa couleur, avec un motif discret.
 * Le dessin dépend du titre : un même podcast garde toujours la même couverture.
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

function GeneralArt({ id, color, seed }: { id: string; color: string; seed: number }) {
  const variant = seed % 3;
  return (
    <svg className="cover__art" viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="#0d1111" />
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      <g fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1">
        {variant === 0 && [18, 30, 42, 54, 66].map((r) => <circle key={r} cx="100" cy="100" r={r} />)}
        {variant === 1 && [0, 14, 28, 42, 56, 70, 84, 98].map((x) => <line key={x} x1={x - 30} y1="100" x2={x + 30} y2="0" />)}
        {variant === 2 && <path d={starPath(50, 50, 44, 32)} />}
      </g>
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
  return (
    <div className={`artwork cover cover--${resolved} ${className}`} style={style} role="img" aria-label={alt}>
      {resolved === 'quran' ? (
        <QuranArt id={id} />
      ) : resolved === 'islamic' ? (
        <IslamicArt id={id} seed={seed} />
      ) : (
        <>
          <GeneralArt id={id} color={genreColor} seed={seed} />
          <Icon className="cover__icon" strokeWidth={1.5} aria-hidden />
        </>
      )}
    </div>
  );
}
