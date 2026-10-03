import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { BookOpen, ChartColumn, Clock, Crown, FolderOpen, House, Library, ListMusic, Mic, Search, ShieldCheck, Sparkle, User, Users, WifiOff } from 'lucide-react';
import { useModeration } from '../store/moderation';
import { PlaylistDialogProvider } from './Playlists';
import { AppMark, Wordmark } from './Wordmark';
import { resolveBackground, sidebarBackground } from '../data/wallpapers';
import { useCustomImages } from '../store/customImages';
import { usePremium } from '../store/premium';
import { useAuth } from '../store/auth';
import { useLibrary } from '../store/library';
import { SKIP_BACK, SKIP_FORWARD, usePlayer } from '../store/player';
import { Artwork } from './common';
import { BackgroundTasks, useOnline } from './Background';
import { FullPlayer, PlayerBar } from './Player';
import { podcastPath } from '../lib/paths';
import { EXPAND_PLAYER_EVENT } from './playLocal';

const SIDEBAR_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/coran', label: 'Coran', icon: BookOpen },
  { to: '/islam', label: 'Podcasts islamiques', icon: Mic },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/fichiers', label: 'Mes fichiers', icon: FolderOpen },
  { to: '/priere', label: 'Prière', icon: Clock },
  { to: '/queue', label: "File d'attente", icon: ListMusic },
  { to: '/friends', label: 'Amis', icon: Users },
  { to: '/stats', label: 'Statistiques', icon: ChartColumn },
];

const MOBILE_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/coran', label: 'Coran', icon: BookOpen },
  { to: '/search', label: 'Rechercher', icon: Search },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/account', label: 'Moi', icon: User },
];

/**
 * Raccourcis clavier : espace = lecture/pause, ← / → = reculer / avancer, M = couper le son,
 * ↑ / ↓ = volume (grand lecteur ouvert, pour ne pas gêner le défilement des pages).
 */
function useKeyboardShortcuts(expanded: boolean) {
  const { toggle, skip, current, volume, setVolume, toggleMute } = usePlayer();
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
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (expanded && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        setVolume(Math.round((volume + (e.key === 'ArrowUp' ? 0.1 : -0.1)) * 10) / 10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, skip, current, expanded, volume, setVolume, toggleMute]);
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
  const { subscriptions, settings } = useLibrary();
  const { isPremium } = usePremium();
  // Un fond réservé à Podsal+ (ou une image importée) revient au fond par défaut quand l'abonnement prend fin.
  const images = useCustomImages();
  const wallpaper = resolveBackground('main', settings.wallpaper, isPremium, images.wallpaperUrl('main'));
  const sidebarBg = resolveBackground('sidebar', settings.sidebarWallpaper, isPremium, images.wallpaperUrl('sidebar'));
  const { isAdmin, isModerator } = useModeration();
  const { current } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const online = useOnline();
  const closePlayer = useCallback(() => setExpanded(false), []);

  useKeyboardShortcuts(expanded);

  // « Mes fichiers » : une vidéo lancée s'ouvre dans le grand lecteur.
  useEffect(() => {
    const onExpand = () => setExpanded(true);
    window.addEventListener(EXPAND_PLAYER_EVENT, onExpand);
    return () => window.removeEventListener(EXPAND_PLAYER_EVENT, onExpand);
  }, []);

  // Remonte en haut de page à chaque navigation.
  useEffect(() => {
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <PlaylistDialogProvider>
      <div className={`app ${current ? 'app--with-player' : ''}`}>
        <BackgroundTasks />
        <aside
          className="sidebar"
          data-wallpaper={sidebarBg.id}
          style={sidebarBg.id === 'uni' ? undefined : { background: sidebarBackground(sidebarBg.background) }}
        >
          <Link to="/" className="brand" aria-label="Podsal, accueil">
            <span className="brand__mark">
              <AppMark title="" />
            </span>
            <Wordmark className="brand__wordmark" title="" />
          </Link>
          <nav className="sidebar__nav">
            {SIDEBAR_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-link">
                <Icon size={22} />
                {label}
              </NavLink>
            ))}
            <NavLink to="/premium" className="nav-link nav-link--premium">
              <Sparkle size={22} />
              {isPremium ? 'Podsal+ · actif' : 'Podsal+'}
            </NavLink>
            {isModerator && (
              <NavLink to="/moderation" className="nav-link">
                <ShieldCheck size={22} />
                Modération
              </NavLink>
            )}
            {isAdmin && (
              <NavLink to="/admin" className="nav-link">
                <Crown size={22} />
                Administration
              </NavLink>
            )}
          </nav>
          <div className="sidebar__subs">
            <div className="sidebar__heading">Vos abonnements</div>
            {subscriptions.length === 0 && <p className="small muted">Abonnez-vous à des podcasts pour les retrouver ici.</p>}
            {subscriptions.map((p) => (
              <NavLink key={p.id} to={podcastPath(p.id)} className="sub-link">
                <Artwork alt={p.title} size={40} podcastId={p.id} genre={p.genre} genreIds={p.genreIds} />
                <span>
                  <span className="sub-link__title">{p.title}</span>
                  <span className="sub-link__author">{p.author}</span>
                </span>
              </NavLink>
            ))}
          </div>
          <AccountLink />
        </aside>

        <main className="main" data-wallpaper={wallpaper.id} style={wallpaper.id === 'halo' ? undefined : { background: wallpaper.background }}>
          {!online && (
            <div className="offline-banner" role="status">
              <WifiOff size={16} /> Hors-ligne : les épisodes téléchargés restent disponibles dans la Bibliothèque.
            </div>
          )}
          <div className="route-view" key={location.pathname}>
            <Outlet />
          </div>
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
    </PlaylistDialogProvider>
  );
}
