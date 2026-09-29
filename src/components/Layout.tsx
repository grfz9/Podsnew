import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ChartColumn, House, Library, ListMusic, Mic, Search, User, Users, WifiOff } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { SKIP_BACK, SKIP_FORWARD, usePlayer } from '../store/player';
import { Artwork } from './common';
import { BackgroundTasks, useOnline } from './Background';
import { FullPlayer, PlayerBar } from './Player';

const SIDEBAR_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/queue', label: "File d'attente", icon: ListMusic },
  { to: '/friends', label: 'Amis', icon: Users },
  { to: '/stats', label: 'Statistiques', icon: ChartColumn },
  { to: '/studio', label: 'Studio', icon: Mic },
];

const MOBILE_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/friends', label: 'Amis', icon: Users },
  { to: '/account', label: 'Compte', icon: User },
];

/** Raccourcis clavier : espace = lecture/pause, ← / → = reculer / avancer. */
function useKeyboardShortcuts() {
  const { toggle, skip, current } = usePlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"] [role="menu"]')) return;
      if (e.code === 'Space' && !target.closest('button, a, [tabindex]')) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft' && !target.closest('[role="listitem"]')) {
        skip(-SKIP_BACK);
      } else if (e.key === 'ArrowRight' && !target.closest('[role="listitem"]')) {
        skip(SKIP_FORWARD);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, skip, current]);
}

function AccountLink() {
  const auth = useAuth();
  const name = auth.profile?.display_name || auth.profile?.username;
  return (
    <NavLink to="/account" className="nav-link sidebar__account">
      {name ? (
        <span className="avatar avatar--small" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <User size={22} />
      )}
      {name ?? (auth.enabled ? 'Se connecter' : 'Compte')}
    </NavLink>
  );
}

export function Layout() {
  const { subscriptions } = useLibrary();
  const { current } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const online = useOnline();
  const closePlayer = useCallback(() => setExpanded(false), []);

  useKeyboardShortcuts();

  // Remonte en haut de page à chaque navigation.
  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={`app ${current ? 'app--with-player' : ''}`}>
      <BackgroundTasks />
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand__logo">
            <Mic size={18} />
          </span>
          Podsnew
        </Link>
        <nav className="sidebar__nav">
          {SIDEBAR_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__subs">
          <div className="sidebar__heading">Vos abonnements</div>
          {subscriptions.length === 0 && <p className="small muted">Abonnez-vous à des podcasts pour les retrouver ici.</p>}
          {subscriptions.map((p) => (
            <NavLink key={p.id} to={`/podcast/${p.id}`} className="sub-link">
              <Artwork src={p.artwork} alt={p.title} size={40} />
              <span>
                <span className="sub-link__title">{p.title}</span>
                <span className="sub-link__author">{p.author}</span>
              </span>
            </NavLink>
          ))}
        </div>
        <AccountLink />
      </aside>

      <main className="main">
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} /> Hors-ligne : les épisodes téléchargés restent disponibles dans la Bibliothèque.
          </div>
        )}
        <Outlet />
      </main>

      <PlayerBar onExpand={() => setExpanded(true)} />

      <nav className="bottom-nav">
        {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__link">
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {expanded && <FullPlayer onClose={closePlayer} />}
    </div>
  );
}
