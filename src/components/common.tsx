import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LoaderCircle, Star } from 'lucide-react';

/** Couleurs des couvertures (tons sobres, sans violet). */
const COVER_COLORS = ['#2f4f4f', '#0f5f73', '#1e3a8a', '#6b4f2a', '#4d6b1f', '#334155', '#7a2e2e', '#8a6d1f', '#23523a', '#3f4f5f'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Première lettre significative d'un titre (ignore « Le », « La », « Les », « The »…). */
export function coverInitial(title: string): string {
  const words = title
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  const skip = new Set(['le', 'la', 'les', 'the', 'un', 'une', 'des', 'du', 'de']);
  const word = words.find((w) => !skip.has(w.toLowerCase())) ?? words[0] ?? '?';
  return word.charAt(0).toUpperCase();
}

/**
 * Couverture neutre générée à partir du titre : aucune image de podcast n'est affichée
 * (beaucoup de pochettes représentent des personnes). Le paramètre `src` est ignoré volontairement.
 */
export function Artwork({
  alt,
  size,
  className = '',
  kind = 'podcast',
}: {
  src?: string;
  alt: string;
  size?: number;
  className?: string;
  kind?: 'podcast' | 'quran';
}) {
  const color = kind === 'quran' ? '#2f4f4f' : COVER_COLORS[hash(alt) % COVER_COLORS.length];
  const style = { background: color, ...(size ? { width: size, height: size } : {}) };
  const fontSize = size ? Math.max(14, size * 0.42) : undefined;
  return (
    <div className={`artwork cover ${className}`} style={style} role="img" aria-label={alt}>
      <svg className="cover__pattern" viewBox="0 0 100 100" aria-hidden>
        {/* Étoile à huit branches (motif géométrique) */}
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="22" y="22" width="56" height="56" />
          <rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" />
          <circle cx="50" cy="50" r="12" />
        </g>
      </svg>
      <span className="cover__letter" style={fontSize ? { fontSize } : undefined}>
        {kind === 'quran' ? 'ق' : coverInitial(alt)}
      </span>
    </div>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={28} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const offline = error.message === 'Failed to fetch' || (typeof navigator !== 'undefined' && !navigator.onLine);
  return (
    <div className="state state--error" role="alert">
      <p>Le chargement a échoué.</p>
      <p className="muted small">{offline ? 'Vérifiez votre connexion internet.' : error.message}</p>
      {onRetry && (
        <button className="btn btn--outline" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'tab--active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Note de 1 à 5 (affichage, ou saisie si `onChange` est fourni). */
export function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sur 5`}
            className="stars__btn"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            <Star size={size} fill={n <= shown ? 'currentColor' : 'none'} />
          </button>
        ) : (
          <Star key={n} size={size} fill={n <= Math.round(shown) ? 'currentColor' : 'none'} />
        ),
      )}
    </span>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Menu déroulant accessible (fermeture au clic extérieur et avec Échap). */
export function Menu({ trigger, label, items, align = 'right' }: { trigger: ReactNode; label: string; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={ref}>
      <button className="icon-btn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className={`menu menu--down menu--${align}`} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={item.danger ? 'menu__danger' : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Copie un texte ou ouvre le partage natif ; renvoie un message à afficher. */
export async function shareLink(title: string, url: string): Promise<string | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return null;
    } catch {
      return null;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Lien copié';
  } catch {
    return url;
  }
}

/** Partage un texte (partage natif, sinon copie dans le presse-papiers). */
export async function shareText(title: string, text: string): Promise<string | null> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
    } catch {
      /* partage annulé */
    }
    return null;
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'Texte copié';
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} Go`;
}
