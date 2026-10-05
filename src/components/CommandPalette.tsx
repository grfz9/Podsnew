import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  BookOpen,
  BookOpenText,
  ChartColumn,
  Clock,
  Compass,
  CornerDownLeft,
  Download,
  FolderOpen,
  Headphones,
  House,
  Keyboard,
  Library,
  ListMusic,
  Mic,
  Moon,
  Pause,
  Play,
  Search,
  Settings,
  Sparkle,
  Sparkles,
  Users,
} from 'lucide-react';
import { normalizeName } from '../data/reciters';
import { getSurah, SURAHS } from '../data/surahs';
import { useLibrary } from '../store/library';
import { usePlayer } from '../store/player';
import { SHOW_WHATS_NEW_EVENT } from './WhatsNew';

export const SHOW_SHORTCUTS_EVENT = 'podsal:raccourcis';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  /** Mots qui permettent de la trouver en plus du libellé. */
  keywords?: string;
}

const PAGES: { to: string; label: string; icon: ReactNode; keywords?: string }[] = [
  { to: '/', label: 'Accueil', icon: <House size={18} /> },
  { to: '/coran', label: 'Écouter le Coran', icon: <Headphones size={18} />, keywords: 'recitateurs recitation quran' },
  { to: '/lire', label: 'Lire le Coran', icon: <BookOpenText size={18} />, keywords: 'lecture mushaf quran' },
  { to: '/lire/recherche', label: 'Chercher un mot dans le Coran', icon: <Search size={18} />, keywords: 'recherche verset' },
  { to: '/islam', label: 'Podcasts islamiques', icon: <Mic size={18} />, keywords: 'cours rappels khoutba' },
  { to: '/priere', label: 'Horaires de prière', icon: <Clock size={18} />, keywords: 'priere adhan salat' },
  { to: '/qibla', label: 'Qibla', icon: <Compass size={18} />, keywords: 'boussole direction kaaba' },
  { to: '/ramadan', label: 'Ramadan', icon: <Moon size={18} />, keywords: 'jeune iftar suhoor' },
  { to: '/library', label: 'Bibliothèque', icon: <Library size={18} />, keywords: 'favoris abonnements telechargements' },
  { to: '/fichiers', label: 'Mes fichiers', icon: <FolderOpen size={18} /> },
  { to: '/queue', label: 'File d’attente', icon: <ListMusic size={18} /> },
  { to: '/friends', label: 'Amis', icon: <Users size={18} /> },
  { to: '/stats', label: 'Statistiques', icon: <ChartColumn size={18} /> },
  { to: '/premium', label: 'Podsal+', icon: <Sparkle size={18} />, keywords: 'abonnement premium' },
  { to: '/parametres', label: 'Paramètres', icon: <Settings size={18} />, keywords: 'reglages compte mot de passe' },
  { to: '/telecharger', label: 'Télécharger l’appli', icon: <Download size={18} />, keywords: 'installer' },
];

/** Palette de commandes (Ctrl + K) : ouvrir une sourate, aller à une page, lecture/pause… au clavier. */
export function CommandPalette() {
  const navigate = useNavigate();
  const player = usePlayer();
  const library = useLibrary();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === '?' && !typing && !open) {
        e.preventDefault();
        window.dispatchEvent(new Event(SHOW_SHORTCUTS_EVENT));
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('podsal:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('podsal:palette', onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const q = normalizeName(query.trim());
    const go = (to: string) => () => navigate(to);
    const out: Command[] = [];

    // Sourates : par numéro, nom ou sens.
    if (q) {
      const n = Number(q);
      const surahs = Number.isInteger(n) && n >= 1 && n <= 114 ? [getSurah(n)!] : SURAHS.filter((s) => normalizeName(s.name).includes(q) || normalizeName(s.meaning).includes(q)).slice(0, 5);
      for (const s of surahs) {
        out.push({ id: `lire-${s.number}`, label: `Lire ${s.number}. ${s.name}`, hint: s.meaning, icon: <BookOpen size={18} />, run: go(`/lire/${s.number}`) });
      }
    }

    // Actions
    const last = library.settings.quran.lastRead;
    const actions: Command[] = [
      ...(player.current
        ? [{ id: 'toggle', label: player.isPlaying ? 'Mettre en pause' : 'Reprendre la lecture', hint: player.current.title, icon: player.isPlaying ? <Pause size={18} /> : <Play size={18} />, run: player.toggle, keywords: 'lecture pause play' }]
        : []),
      ...(last ? [{ id: 'reprendre', label: 'Reprendre la lecture du Coran', hint: `${getSurah(last.surah)?.name} ${last.ayah}`, icon: <BookOpenText size={18} />, run: go(`/lire/${last.surah}?v=${last.ayah}`) }] : []),
      { id: 'nouveautes', label: 'Quoi de neuf ?', icon: <Sparkles size={18} />, run: () => window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT)), keywords: 'nouveautes mise a jour' },
      { id: 'raccourcis', label: 'Raccourcis clavier', icon: <Keyboard size={18} />, run: () => window.dispatchEvent(new Event(SHOW_SHORTCUTS_EVENT)), keywords: 'clavier aide' },
    ];
    const pages: Command[] = PAGES.map((p) => ({ id: p.to, label: p.label, icon: p.icon, run: go(p.to), keywords: p.keywords }));
    const match = (c: Command) => !q || normalizeName(`${c.label} ${c.keywords ?? ''}`).includes(q);
    out.push(...actions.filter(match), ...pages.filter(match));

    if (q) {
      out.push(
        { id: 'chercher', label: `Rechercher « ${query.trim()} » dans Podsal`, icon: <Search size={18} />, run: go(`/search?q=${encodeURIComponent(query.trim())}`) },
        { id: 'coran', label: `Chercher « ${query.trim()} » dans le Coran`, icon: <BookOpenText size={18} />, run: go(`/lire/recherche?q=${encodeURIComponent(query.trim())}`) },
      );
    }
    return out.slice(0, 12);
  }, [query, navigate, player, library.settings.quran.lastRead]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;
  const run = (c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    c.run();
  };
  return (
    <div className="palette-backdrop" onClick={() => setOpen(false)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Palette de commandes" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, commands.length - 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === 'Enter') (e.preventDefault(), run(commands[active]));
              else if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Une sourate (« kahf », « 18 »), une page, une action…"
            aria-label="Commande"
          />
          <kbd>Échap</kbd>
        </div>
        <ul className="palette__list" ref={listRef} role="listbox">
          {commands.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active} data-index={i}>
              <button className={`palette__item ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => run(c)}>
                <span className="palette__icon">{c.icon}</span>
                <span className="palette__text">
                  <strong>{c.label}</strong>
                  {c.hint && <span className="small muted">{c.hint}</span>}
                </span>
                {i === active && <CornerDownLeft size={15} className="muted" />}
              </button>
            </li>
          ))}
          {!commands.length && <li className="small muted palette__empty">Aucun résultat.</li>}
        </ul>
      </div>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Ctrl + K ou /', 'Palette de commandes (sourate, page, action)'],
  ['Espace', 'Lecture / pause'],
  ['← / →', 'Reculer / avancer'],
  ['M', 'Couper / remettre le son'],
  ['↑ / ↓', 'Volume (lecteur agrandi)'],
  ['?', 'Afficher ces raccourcis'],
  ['Échap', 'Fermer une fenêtre'],
];

/** Aide des raccourcis clavier (touche « ? »). */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener(SHOW_SHORTCUTS_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(SHOW_SHORTCUTS_EVENT, show);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={() => setOpen(false)}>
      <div className="dialog shortcuts-help" role="dialog" aria-modal="true" aria-label="Raccourcis clavier" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <h2>
            <Keyboard size={18} /> Raccourcis clavier
          </h2>
        </div>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn btn--primary" onClick={() => setOpen(false)}>
          Compris
        </button>
      </div>
    </div>
  );
}
