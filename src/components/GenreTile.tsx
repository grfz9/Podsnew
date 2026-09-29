import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  Blocks,
  BookOpenText,
  Clapperboard,
  Cpu,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Hourglass,
  Landmark,
  Newspaper,
  Palette,
  PartyPopper,
  Siren,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Genre } from '../types';

/** Icône de chaque catégorie (aucune représentation d'être vivant). */
const GENRE_ICONS: Record<number, LucideIcon> = {
  1489: Newspaper,
  1303: PartyPopper,
  1324: Landmark,
  1487: Hourglass,
  1488: Siren,
  1533: FlaskConical,
  1318: Cpu,
  1321: TrendingUp,
  1304: GraduationCap,
  1545: Trophy,
  1512: HeartPulse,
  1301: Palette,
  1483: BookOpenText,
  1309: Clapperboard,
  1305: Blocks,
  1502: Gamepad2,
};

export function genreIcon(id: number): LucideIcon {
  return GENRE_ICONS[id] ?? BookOpenText;
}

/**
 * Tuile colorée : titre en haut, grande icône inclinée en bas à droite,
 * reflet lumineux de la même teinte. `size="large"` pour la page Rechercher.
 */
export function Tile({
  to,
  label,
  icon: Icon,
  color,
  size = 'normal',
  index = 0,
  pattern = false,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  color: string;
  size?: 'normal' | 'large';
  index?: number;
  /** Motif géométrique (étoiles à huit branches) en filigrane. */
  pattern?: boolean;
}) {
  return (
    <Link to={to} className={`tile-link tile-link--${size}`} style={{ '--tile': color, '--i': Math.min(index, 12) } as CSSProperties}>
      {pattern && <span className="tile-link__pattern" aria-hidden />}
      <span className="tile-link__label">{label}</span>
      <Icon className="tile-link__icon" strokeWidth={1.6} aria-hidden />
    </Link>
  );
}

export function GenreTile({ genre, size, index }: { genre: Genre; size?: 'normal' | 'large'; index?: number }) {
  return <Tile to={`/genre/${genre.id}`} label={genre.name} icon={genreIcon(genre.id)} color={genre.color} size={size} index={index} />;
}
