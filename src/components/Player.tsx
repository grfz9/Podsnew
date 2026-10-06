import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronDown,
  FileText,
  Scissors,
  ListMusic,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SKIP_BACK, SKIP_FORWARD, usePlayer, usePlayerTime } from '../store/player';
import { formatTime, stripHtml } from '../utils/format';
import { getAnyPodcast } from '../api/catalog';
import { useLibrary } from '../store/library';
import { useAsync } from '../utils/hooks';
import { currentChapterIndex, useEpisodeExtras } from '../lib/useEpisode';
import { Artwork, NowPlaying } from './common';
import { episodePath } from './EpisodeRow';
import { podcastPath } from '../lib/paths';
import { isLocalId } from '../lib/localFiles';
import { LocalVideo } from './LocalVideo';
import { QuranVerses } from './QuranVerses';
import { isQuranId } from '../lib/policy';
import { parseSurahEpisodeId } from '../api/quran';

function ProgressBar() {
  const { seek } = usePlayer();
  const { time, duration } = usePlayerTime();
  const [dragValue, setDragValue] = useState<number | null>(null);
  const value = dragValue ?? time;
  const max = duration || 1;

  return (
    <div className="progress">
      <span className="progress__time">{formatTime(value)}</span>
      <input
        type="range"
        className="slider"
        min={0}
        max={max}
        step={1}
        value={Math.min(value, max)}
        style={{ '--fill': `${(Math.min(value, max) / max) * 100}%` } as CSSProperties}
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerUp={() => {
          if (dragValue !== null) seek(dragValue);
          setDragValue(null);
        }}
        onKeyUp={() => {
          if (dragValue !== null) seek(dragValue);
          setDragValue(null);
        }}
        aria-label="Position de lecture"
      />
      <span className="progress__time">-{formatTime(Math.max(0, duration - value))}</span>
    </div>
  );
}

function Controls({ large = false }: { large?: boolean }) {
  const { isPlaying, isBuffering, toggle, skip, next, queue } = usePlayer();
  const size = large ? 30 : 22;
  return (
    <div className={`controls ${large ? 'controls--large' : ''}`}>
      <button className="icon-btn skip-btn" onClick={() => skip(-SKIP_BACK)} aria-label={`Reculer de ${SKIP_BACK} secondes`}>
        <RotateCcw size={size} />
        <span>{SKIP_BACK}</span>
      </button>
      <button className="play-btn" onClick={toggle} aria-label={isPlaying ? 'Pause' : 'Lecture'}>
        {isBuffering && isPlaying ? (
          <LoaderCircle className="spin" size={size} />
        ) : isPlaying ? (
          <Pause size={size} fill="currentColor" />
        ) : (
          <Play size={size} fill="currentColor" />
        )}
      </button>
      <button className="icon-btn skip-btn" onClick={() => skip(SKIP_FORWARD)} aria-label={`Avancer de ${SKIP_FORWARD} secondes`}>
        <RotateCw size={size} />
        <span>{SKIP_FORWARD}</span>
      </button>
      <button className="icon-btn" onClick={next} disabled={queue.length === 0} aria-label="Épisode suivant">
        <SkipForward size={size - 2} />
      </button>
    </div>
  );
}

function RateButton() {
  const { rate, cycleRate } = usePlayer();
  return (
    <button className="ctrl-btn" onClick={cycleRate} title="Vitesse de lecture" aria-label={`Vitesse ${rate}x`}>
      {rate}×
    </button>
  );
}

function useSleepCountdown(): string | null {
  const { sleep } = usePlayer();
  const [, force] = useState(0);
  useEffect(() => {
    if (sleep?.kind !== 'minutes') return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [sleep]);
  if (!sleep) return null;
  if (sleep.kind === 'episode') return 'Fin épisode';
  return formatTime(Math.max(0, (sleep.endsAt - Date.now()) / 1000));
}

function SleepButton() {
  const { sleep, setSleep } = usePlayer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const countdown = useSleepCountdown();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (v: number | 'episode' | null) => {
    setSleep(v);
    setOpen(false);
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button
        className={`ctrl-btn ${sleep ? 'ctrl-btn--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Minuteur de sommeil"
        aria-label="Minuteur de sommeil"
      >
        <Moon size={14} />
        {countdown && <span>{countdown}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu__title">Arrêter la lecture dans…</div>
          {[5, 15, 30, 45, 60].map((m) => (
            <button key={m} role="menuitem" onClick={() => choose(m)}>
              {m} minutes
            </button>
          ))}
          <button role="menuitem" onClick={() => choose('episode')}>
            À la fin de l'épisode
          </button>
          {sleep && (
            <button role="menuitem" className="menu__danger" onClick={() => choose(null)}>
              Désactiver le minuteur
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** iPhone et iPad : le volume se règle uniquement avec les boutons de l'appareil (le curseur n'aurait aucun effet). */
const FIXED_VOLUME =
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

function VolumeControl({ full = false }: { full?: boolean }) {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const v = muted ? 0 : volume;
  if (full && FIXED_VOLUME) {
    return (
      <button className="ctrl-btn" onClick={toggleMute} aria-label={muted ? 'Réactiver le son' : 'Couper le son'}>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'Son coupé' : 'Son'}
      </button>
    );
  }
  return (
    <div className={`volume ${full ? 'volume--full' : ''}`} title="Volume (↑ / ↓, M pour couper)">
      <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Réactiver le son' : 'Couper le son'}>
        {v === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range"
        className="slider"
        min={0}
        max={1}
        step={0.01}
        value={v}
        style={{ '--fill': `${v * 100}%` } as CSSProperties}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
      />
      {full && <span className="volume__value">{Math.round(v * 100)} %</span>}
    </div>
  );
}

/** Relecture en boucle de l'épisode ou du fichier en cours. */
function RepeatButton() {
  const { current, repeat, setRepeat } = usePlayer();
  if (!current) return null;
  const on = repeat?.episodeId === current.id && repeat.remaining === Infinity && repeat.end === undefined;
  return (
    <button
      className={`ctrl-btn ${on ? 'ctrl-btn--active' : ''}`}
      onClick={() => setRepeat(on ? null : { episodeId: current.id, remaining: Infinity, start: 0 })}
      aria-pressed={on}
      title="Relire en boucle"
    >
      <Repeat size={14} /> Répéter
    </button>
  );
}

/** Barre de lecture fixée en bas de l'écran. */
export function PlayerBar({ onExpand }: { onExpand: () => void }) {
  const player = usePlayer();
  const { time, duration } = usePlayerTime();
  const navigate = useNavigate();
  const ep = player.current;
  if (!ep) return null;

  const swipeUp = useRef<number | null>(null);
  return (
    <footer className="player-bar">
      {/* Fine barre de progression (mobile) */}
      <div className="player-bar__line" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />

      <div
        className="player-bar__info"
        onClick={onExpand}
        role="button"
        tabIndex={0}
        aria-label="Ouvrir le lecteur"
        onTouchStart={(e) => (swipeUp.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          const y0 = swipeUp.current;
          swipeUp.current = null;
          if (y0 !== null && y0 - e.changedTouches[0].clientY > 40) onExpand();
        }}
      >
        <span className="player-bar__art">
          <Artwork alt={ep.podcastTitle} size={56} podcastId={ep.podcastId} genre={ep.genre} />
          {player.isPlaying && <NowPlaying />}
        </span>
        <div className="player-bar__text">
          <div className="player-bar__title">{ep.title}</div>
          <div className="player-bar__podcast">{ep.podcastTitle}</div>
          {player.error && <div className="player-bar__error">{player.error}</div>}
        </div>
      </div>

      <div className="player-bar__center">
        <Controls />
        <ProgressBar />
      </div>

      <div className="player-bar__right">
        <RateButton />
        <SleepButton />
        <button className="icon-btn" onClick={() => navigate('/queue')} aria-label="File d'attente" title="File d'attente">
          <ListMusic size={18} />
          {player.queue.length > 0 && <span className="badge">{player.queue.length}</span>}
        </button>
        <VolumeControl />
      </div>

      {/* Bouton lecture compact (mobile) */}
      <button className="play-btn play-btn--mobile" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Lecture'}>
        {player.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>
    </footer>
  );
}

/** Lecteur plein écran (mobile / clic sur la pochette). */
/**
 * Glisser vers le bas pour fermer le lecteur plein écran (comme Spotify ou Musique).
 * Ignoré sur les zones qui ont leur propre geste (barre de progression, versets, vidéo, curseurs).
 */
function useSwipeDown(onClose: () => void) {
  const start = useRef<{ y: number; x: number; scroll: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const onTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, [role="slider"], .progress, .verses, .local-video, textarea, select')) return;
    // Seulement tout en haut du lecteur : sinon le geste sert à faire défiler.
    const scroll = e.currentTarget.scrollTop + ((target.closest('.full-player__content') as HTMLElement | null)?.scrollTop ?? 0);
    start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX, scroll };
  };
  const onTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    const s0 = start.current;
    if (!s0 || s0.scroll > 0) return;
    const dy = e.touches[0].clientY - s0.y;
    const dx = Math.abs(e.touches[0].clientX - s0.x);
    if (dy > 0 && dy > dx) setOffset(dy);
  };
  const onTouchEnd = () => {
    if (offset > 110) onClose();
    setOffset(0);
    start.current = null;
  };
  return { offset, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd } };
}

export function FullPlayer({ onClose }: { onClose: () => void }) {
  const swipe = useSwipeDown(onClose);
  const player = usePlayer();
  const { country } = useLibrary();
  const { time } = usePlayerTime();
  const navigate = useNavigate();
  const ep = player.current;
  // Fichier personnel (importé, ou publié par un ami) ou sourate : pas de podcast à charger (ni chapitres, ni transcription).
  const local = !!ep && (isLocalId(ep.id) || !!ep.mediaKind);
  const quran = !!ep && isQuranId(ep.podcastId) && !!parseSurahEpisodeId(ep.id);
  // Sourate : versets qui défilent (par défaut) ou visuel ; le choix est retenu.
  const [view, setView] = useState<'verses' | 'art'>(() => {
    try {
      return localStorage.getItem('podsal:quran-view') === 'art' ? 'art' : 'verses';
    } catch {
      return 'verses';
    }
  });
  const chooseView = (v: 'verses' | 'art') => {
    setView(v);
    try {
      localStorage.setItem('podsal:quran-view', v);
    } catch {
      /* préférence non retenue */
    }
  };
  const podcast = useAsync(() => (ep && !local && !quran ? getAnyPodcast(ep.podcastId, country, 200) : Promise.resolve(null)), [ep?.podcastId, local, quran, country]);
  const extras = useEpisodeExtras(podcast.data?.podcast, ep ?? undefined);
  const chapterIndex = currentChapterIndex(extras.chapters, time);
  const chapter = chapterIndex >= 0 ? extras.chapters[chapterIndex] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!ep) return null;
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className={`full-player ${swipe.offset ? 'is-dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Lecteur"
      {...swipe.handlers}
      style={swipe.offset ? { transform: `translateY(${swipe.offset}px)`, opacity: Math.max(0.4, 1 - swipe.offset / 600) } : undefined}
    >
      <button className="full-player__handle" onClick={onClose} aria-label="Fermer le lecteur (ou glisser vers le bas)" />
      <div className={`full-player__content ${ep.mediaKind === 'video' ? 'full-player__content--video' : ''}`}>
        <div className="full-player__top">
          <button className="icon-btn" onClick={onClose} aria-label="Fermer le lecteur">
            <ChevronDown size={28} />
          </button>
          {quran ? (
            <div className="full-player__switch" role="tablist" aria-label="Affichage">
              <button role="tab" aria-selected={view === 'verses'} className={view === 'verses' ? 'on' : ''} onClick={() => chooseView('verses')}>
                Versets
              </button>
              <button role="tab" aria-selected={view === 'art'} className={view === 'art' ? 'on' : ''} onClick={() => chooseView('art')}>
                Visuel
              </button>
            </div>
          ) : (
            <span className="small muted">En cours de lecture</span>
          )}
          <button className="icon-btn" onClick={() => go('/queue')} aria-label="File d'attente">
            <ListMusic size={22} />
          </button>
        </div>
        {ep.mediaKind === 'video' ? (
          <LocalVideo
            episodeId={ep.id}
            fallbackSrc={ep.videoUrl ?? ep.audioUrl}
            title={ep.title}
            controls={
              <>
                <ProgressBar />
                <div className="local-video__row">
                  <Controls />
                  <span className="local-video__extras">
                    <VolumeControl full />
                    <RateButton />
                  </span>
                </div>
              </>
            }
          />
        ) : quran && view === 'verses' ? (
          <QuranVerses episode={ep} />
        ) : (
          <Artwork
            src={chapter?.img || ep.artwork}
            alt={ep.podcastTitle}
            podcastId={ep.podcastId}
            genre={ep.genre}
            className={`full-player__art ${player.isPlaying ? '' : 'full-player__art--paused'}`}
          />
        )}
        <div className="full-player__meta">
          {chapter && <p className="full-player__chapter">Chapitre {chapterIndex + 1} · {chapter.title}</p>}
          <h2>
            <button className="link-button" onClick={() => go(episodePath(ep))}>
              {ep.title}
            </button>
          </h2>
          <button className="link-button muted" onClick={() => go(podcastPath(ep.podcastId))}>
            {ep.podcastTitle}
          </button>
        </div>
        {player.error && <p className="player-bar__error">{player.error}</p>}
        <ProgressBar />
        <Controls large />
        <VolumeControl full />
        <div className="full-player__extras">
          <RateButton />
          <SleepButton />
          <RepeatButton />
          {!local && (
            <button className="ctrl-btn" onClick={() => go(`${episodePath(ep)}?clip=1`)} aria-label="Créer un extrait">
              <Scissors size={14} /> Extrait
            </button>
          )}
          {extras.transcript && (
            <button className="ctrl-btn" onClick={() => go(episodePath(ep))} aria-label="Transcription">
              <FileText size={14} /> Texte
            </button>
          )}
        </div>
        {extras.chapters.length > 0 && (
          <ol className="chapters full-player__chapters">
            {extras.chapters.map((c, i) => (
              <li key={`${c.start}-${i}`}>
                <button className={`chapter ${i === chapterIndex ? 'chapter--active' : ''}`} onClick={() => player.seek(c.start)}>
                  <span className="chapter__time">{formatTime(c.start)}</span>
                  <span className="chapter__title">{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
        {ep.description && <p className="full-player__desc">{stripHtml(ep.description)}</p>}
      </div>
    </div>
  );
}
