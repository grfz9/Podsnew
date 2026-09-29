import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { House, Library, ListMusic, Mic, Search } from 'lucide-react';
import { useLibrary } from '../store/library';
import { SKIP_BACK, SKIP_FORWARD, usePlayer } from '../store/player';
import { Artwork } from './common';
import { FullPlayer, PlayerBar } from './Player';

const NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/queue', label: "File d'attente", icon: ListMusic },
];

/** Raccourcis clavier : espace = lecture/pause, ← / → = reculer / avancer. */
function useKeyboardShortcuts() {
  const { toggle, skip, current } = usePlayer();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!current || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.code === 'Space' && !target.closest('button, a')) {
        e.preventDefault();
        toggle();
      } else if (e.key === 'ArrowLeft') {
        skip(-SKIP_BACK);
      } else if (e.key === 'ArrowRight') {
        skip(SKIP_FORWARD);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, skip, current]);
}

export function Layout() {
  const { subscriptions } = useLibrary();
  const { current } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const closePlayer = useCallback(() => setExpanded(false), []);

  useKeyboardShortcuts();

  // Remonte en haut de page à chaque navigation.
  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={`app ${current ? 'app--with-player' : ''}`}>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand__logo">
            <Mic size={18} />
          </span>
          Podsnew
        </Link>
        <nav className="sidebar__nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
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
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <PlayerBar onExpand={() => setExpanded(true)} />

      <nav className="bottom-nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
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
