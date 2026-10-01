import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';

export interface Shortcut {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Teinte de l'icône (couleur CSS). */
  color: string;
  /** Petit compteur (nombre d'éléments). */
  count?: number;
  /** Mis en évidence (onglet actuel). */
  active?: boolean;
}

/**
 * Raccourcis vers les fonctions de l'appli : grille de tuiles (`grid`) ou rangée défilante (`row`).
 * Sur téléphone, ils remplacent les onglets et les menus cachés : tout est visible d'un coup d'œil.
 */
export function Shortcuts({ items, layout = 'grid', label }: { items: Shortcut[]; layout?: 'grid' | 'row'; label: string }) {
  return (
    <nav className={`shortcuts shortcuts--${layout}`} aria-label={label}>
      {items.map(({ to, label: text, icon: Icon, color, count, active }, i) => (
        <Link
          key={to + text}
          to={to}
          replace={layout === 'grid' && to.includes('?tab=')}
          className={`shortcut ${active ? 'shortcut--active' : ''}`}
          style={{ '--tint': color, '--i': i } as CSSProperties}
          aria-current={active ? 'page' : undefined}
        >
          <span className="shortcut__icon" aria-hidden>
            <Icon size={20} strokeWidth={2} />
          </span>
          <span className="shortcut__label">{text}</span>
          {count !== undefined && count > 0 && <span className="shortcut__count">{count > 99 ? '99+' : count}</span>}
        </Link>
      ))}
    </nav>
  );
}
