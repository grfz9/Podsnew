import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import {
  BookOpen,
  BookOpenText,
  ChartColumn,
  ChevronDown,
  Clock,
  Compass,
  Download,
  FolderOpen,
  Headphones,
  Heart,
  History,
  House,
  Library,
  ListMusic,
  Mic,
  Moon,
  Podcast,
  ScanSearch,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { useModeration } from '../store/moderation';
import { usePrayerCountdown } from '../lib/usePrayerCountdown';

interface MenuItem {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

interface Menu {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Pages qui allument ce menu (début de l'adresse). */
  match: string[];
  items: MenuItem[];
}

/**
 * Menus de la barre du haut (ordinateur) : un menu « mère » par rubrique (Coran, Podcasts, Prière, Bibliothèque)
 * qui s'ouvre au clic et affiche ses sous-menus, chacun avec une icône et une courte explication.
 */
function useMenus(ramadanSoon: boolean): Menu[] {
  const { isModerator } = useModeration();
  return [
    {
      id: 'coran',
      label: 'Coran',
      icon: BookOpen,
      match: ['/coran', '/lire'],
      items: [
        { to: '/coran', label: 'Écouter', hint: 'Récitateurs et sourates', icon: Headphones },
        { to: '/lire', label: 'Lire', hint: 'Texte arabe et traduction', icon: BookOpenText },
        { to: '/lire/recherche', label: 'Chercher un mot', hint: 'Dans le texte et la traduction', icon: ScanSearch },
      ],
    },
    {
      id: 'podcasts',
      label: 'Podcasts',
      icon: Mic,
      match: ['/islam', '/podcast', '/moderation', '/studio'],
      items: [
        { to: '/islam', label: 'Podcasts islamiques', hint: 'Cours et rappels vérifiés', icon: Podcast },
        { to: '/library?tab=subscriptions', label: 'Mes abonnements', hint: 'Les podcasts que vous suivez', icon: Heart },
        { to: '/studio', label: 'Studio créateur', hint: 'Publier votre propre podcast', icon: Mic },
        ...(isModerator ? [{ to: '/moderation', label: 'Modération', hint: 'Valider les podcasts proposés', icon: ShieldCheck }] : []),
      ],
    },
    {
      id: 'priere',
      label: 'Prière',
      icon: Clock,
      match: ['/priere', '/qibla', '/ramadan'],
      items: [
        { to: '/priere', label: 'Horaires', hint: 'Les cinq prières du jour', icon: Timer },
        { to: '/qibla', label: 'Qibla', hint: 'Direction de La Mecque', icon: Compass },
        ...(ramadanSoon ? [{ to: '/ramadan', label: 'Ramadan', hint: 'Jeûne, khatma et rappels', icon: Moon }] : []),
      ],
    },
    {
      id: 'bibliotheque',
      label: 'Bibliothèque',
      icon: Library,
      match: ['/library', '/fichiers', '/stats', '/playlist', '/queue'],
      items: [
        { to: '/library?tab=playlists', label: 'Playlists', hint: 'Vos listes et celles partagées', icon: ListMusic },
        { to: '/library?tab=downloads', label: 'Téléchargés', hint: 'À écouter sans connexion', icon: Download },
        { to: '/library?tab=saved', label: 'Favoris', hint: 'Épisodes mis de côté', icon: Heart },
        { to: '/library?tab=history', label: 'Historique', hint: 'Ce que vous avez écouté', icon: History },
        { to: '/fichiers', label: 'Mes fichiers', hint: 'Vos audios et vidéos importés', icon: FolderOpen },
        { to: '/stats', label: 'Statistiques', hint: 'Votre temps d’écoute', icon: ChartColumn },
      ],
    },
  ];
}

function MenuButton({ menu, open, onToggle, extra }: { menu: Menu; open: boolean; onToggle: () => void; extra?: React.ReactNode }) {
  const location = useLocation();
  const active = menu.match.some((m) => location.pathname === m || location.pathname.startsWith(`${m}/`));
  const Icon = menu.icon;
  return (
    <div className={`top-nav__group ${open ? 'top-nav__group--open' : ''}`}>
      <button
        className={`top-nav__btn ${active ? 'active' : ''}`}
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={menu.label}
      >
        <Icon size={20} />
        <span className="top-nav__label">{menu.label}</span>
        {extra}
        <ChevronDown size={15} className="top-nav__chevron" />
      </button>
      {open && (
        <div className="top-nav__menu" role="menu" aria-label={menu.label}>
          {menu.items.map(({ to, label, hint, icon: ItemIcon }) => (
            <Link key={to} to={to} role="menuitem" className="top-nav__item">
              <span className="top-nav__item-icon">
                <ItemIcon size={18} />
              </span>
              <span className="top-nav__item-text">
                <strong>{label}</strong>
                <span>{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopNav({ ramadanSoon }: { ramadanSoon: boolean }) {
  const menus = useMenus(ramadanSoon);
  const countdown = usePrayerCountdown();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const location = useLocation();

  // Fermeture : changement de page, clic ailleurs, touche Échap.
  useEffect(() => setOpen(null), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <nav className="top-nav" aria-label="Rubriques" ref={ref}>
      <NavLink to="/" end className="top-nav__btn" title="Accueil">
        <House size={20} />
        <span className="top-nav__label">Accueil</span>
      </NavLink>
      {menus.map((menu) => (
        <MenuButton
          key={menu.id}
          menu={menu}
          open={open === menu.id}
          onToggle={() => setOpen((o) => (o === menu.id ? null : menu.id))}
          extra={
            menu.id === 'priere' && countdown ? (
              <span className={`top-nav__countdown ${countdown.soon ? 'top-nav__countdown--soon' : ''}`} title={`${countdown.name} à ${countdown.at}`}>
                <span className="top-nav__countdown-name">{countdown.name} </span>
                {countdown.left}
              </span>
            ) : undefined
          }
        />
      ))}
    </nav>
  );
}
