import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BookOpen, BookOpenText, Clock, Headphones, FolderOpen, House, Library, Mic, Moon, Search, Settings, Sparkle, User, Users, WifiOff } from 'lucide-react';
import { ramadanInfo } from '../lib/khatma';
import { formatClock, nextPrayer, PRAYER_NAMES } from '../lib/prayer';
import { useModeration } from '../store/moderation';
import { DesktopUpdateBanner } from './DesktopUpdate';
import { WhatsNew } from './WhatsNew';
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
import { Onboarding, SHOW_ONBOARDING_EVENT } from './Onboarding';

const SIDEBAR_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  // « Coran » regroupe l'écoute (/coran) et la lecture (/lire).
  { to: '/coran', label: 'Coran', icon: BookOpen, also: '/lire' },
  { to: '/islam', label: 'Podcasts islamiques', icon: Mic },
  { to: '/priere', label: 'Prière', icon: Clock },
  { to: '/library', label: 'Bibliothèque', icon: Library },
  { to: '/fichiers', label: 'Mes fichiers', icon: FolderOpen },
];

/** Événement envoyé par la barre de recherche du menu à la page Rechercher. */
export const SEARCH_INPUT_EVENT = 'podsal:search-input';

/** Barre de recherche toujours visible en haut du menu (comme Spotify). */
function SidebarSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const onSearch = location.pathname === '/search';
  useEffect(() => {
    if (!onSearch) setValue('');
  }, [onSearch]);
  const change = (v: string) => {
    setValue(v);
    window.dispatchEvent(new CustomEvent(SEARCH_INPUT_EVENT, { detail: v }));
    if (!onSearch) navigate(`/search?q=${encodeURIComponent(v)}`);
  };
  return (
    <>
      <form className="sidebar-search" role="search" onSubmit={(e) => (e.preventDefault(), change(value))}>
        <Search size={18} />
        <input type="search" value={value} onChange={(e) => change(e.target.value)} placeholder="Rechercher" aria-label="Rechercher dans Podsal" />
      </form>
      <NavLink to="/search" className="nav-link sidebar-search__icon" title="Rechercher">
        <Search size={22} />
      </NavLink>
    </>
  );
}

/** Compte à rebours jusqu'à la prochaine prière, à côté de « Prière » (seconde par seconde). */
function PrayerCountdown() {
  const { settings } = useLibrary();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = nextPrayer(settings.prayer, now);
  if (!next) return null;
  const total = Math.max(0, Math.floor((next.time.getTime() - now.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const left = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return (
    <span className={`nav-countdown ${total < 15 * 60 ? 'nav-countdown--soon' : ''}`} title={`${PRAYER_NAMES[next.key]} à ${formatClock(next.time)}`}>
      <span>{PRAYER_NAMES[next.key]}</span> <strong>{left}</strong>
    </span>
  );
}

/** Podsal+ mis en avant : carte dorée (abonné) ou invitation. */
function PremiumCard({ active }: { active: boolean }) {
  return (
    <NavLink to="/premium" className={`premium-card ${active ? 'premium-card--active' : ''}`} title="Podsal+">
      <span className="premium-card__icon">
        <Sparkle size={18} />
      </span>
      <span className="premium-card__text">
        <strong>{active ? 'Podsal+ actif' : 'Passer à Podsal+'}</strong>
        <span>{active ? 'Merci pour votre soutien' : 'Fonds, téléchargements illimités…'}</span>
      </span>
    </NavLink>
  );
}

const MOBILE_NAV = [
  { to: '/', label: 'Accueil', icon: House, end: true },
  { to: '/coran', label: 'Coran', icon: BookOpen, also: '/lire' },
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
    <div className="sidebar__footer">
    <NavLink to="/account" className="nav-link sidebar__account" title={name ?? 'Compte'}>
      {name ? (
        <span className="avatar avatar--small" aria-hidden>
          {name.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <User size={22} />
      )}
      <span className="nav-link__label">{name ?? (auth.enabled ? 'Se connecter' : 'Compte')}</span>
    </NavLink>
      <NavLink to="/friends" className="icon-btn sidebar__footer-btn" title="Amis" aria-label="Amis">
        <Users size={20} />
      </NavLink>
      <NavLink to="/parametres" className="icon-btn sidebar__footer-btn" title="Paramètres" aria-label="Paramètres">
        <Settings size={20} />
      </NavLink>
    </div>
  );
}

export function Layout() {
  const { settings, subscriptions: allSubscriptions } = useLibrary();
  const { isPremium } = usePremium();
  // Un fond réservé à Podsal+ (ou une image importée) revient au fond par défaut quand l'abonnement prend fin.
  const images = useCustomImages();
  const wallpaper = resolveBackground('main', settings.wallpaper, isPremium, images.wallpaperUrl('main'));
  const sidebarBg = resolveBackground('sidebar', settings.sidebarWallpaper, isPremium, images.wallpaperUrl('sidebar'));
  const { filterPodcasts } = useModeration();
  // Ramadan dans le menu seulement pendant le mois et les 60 jours qui précèdent (sinon : Prière, Paramètres).
  const ramadan = ramadanInfo();
  const ramadanSoon = !!ramadan && (ramadan.day !== null || ramadan.daysUntil <= 60);
  // Anciens abonnements non islamiques : masqués (Podsal est 100 % islamique).
  const subscriptions = filterPodcasts(allSubscriptions);
  const { current } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const online = useOnline();
  const closePlayer = useCallback(() => setExpanded(false), []);

  useKeyboardShortcuts(expanded);

  // Présentation de l'appli : à la première ouverture, ou à la demande depuis « Moi ».
  const [tour, setTour] = useState(false);
  useEffect(() => {
    const onShow = () => setTour(true);
    window.addEventListener(SHOW_ONBOARDING_EVENT, onShow);
    return () => window.removeEventListener(SHOW_ONBOARDING_EVENT, onShow);
  }, []);

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
          <SidebarSearch />
          <nav className="sidebar__nav">
            {SIDEBAR_NAV.map(({ to, label, icon: Icon, end, also }) => (
              <div key={to} className="nav-group">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) => `nav-link ${isActive || (also && location.pathname.startsWith(also)) ? 'active' : ''}`}
                  title={label}
                >
                  <Icon size={22} />
                  <span className="nav-link__label">{label}</span>
                  {to === '/priere' && <PrayerCountdown />}
                </NavLink>
                {to === '/coran' && (
                  // Choisir d'écouter ou de lire avant même d'ouvrir la rubrique.
                  <div className="nav-choice" role="group" aria-label="Coran">
                    <NavLink to="/coran" className="nav-choice__btn" title="Écouter le Coran">
                      <Headphones size={15} /> Écouter
                    </NavLink>
                    <NavLink to="/lire" className="nav-choice__btn" title="Lire le Coran">
                      <BookOpenText size={15} /> Lire
                    </NavLink>
                  </div>
                )}
              </div>
            ))}
            {ramadanSoon && (
              <NavLink to="/ramadan" className="nav-link" title="Ramadan">
                <Moon size={22} />
                <span className="nav-link__label">Ramadan</span>
              </NavLink>
            )}
          </nav>
          <PremiumCard active={isPremium} />
          <div className="sidebar__subs">
            <div className="sidebar__heading">Vos abonnements</div>
            {subscriptions.length === 0 && <p className="small muted">Abonnez-vous à des podcasts pour les retrouver ici.</p>}
            {subscriptions.map((p) => (
              <NavLink key={p.id} to={podcastPath(p.id)} className="sub-link" title={p.title}>
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
          <DesktopUpdateBanner />
          <div className="route-view" key={location.pathname}>
            <Outlet />
          </div>
        </main>

        <PlayerBar onExpand={() => setExpanded(true)} />

        <nav className="bottom-nav">
          {MOBILE_NAV.map(({ to, label, icon: Icon, end, also }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottom-nav__link ${isActive || (also && location.pathname.startsWith(also)) ? 'active' : ''}`}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {expanded && <FullPlayer onClose={closePlayer} />}
        {(tour || !settings.onboarded) && <Onboarding onDone={() => setTour(false)} />}
        {!tour && <WhatsNew />}
      </div>
    </PlaylistDialogProvider>
  );
}
