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

function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const v = muted ? 0 : volume;
  return (
    <div className="volume">
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
    </div>
  );
}

/** Barre de lecture fixée en bas de l'écran. */
export function PlayerBar({ onExpand }: { onExpand: () => void }) {
  const player = usePlayer();
  const { time, duration } = usePlayerTime();
  const navigate = useNavigate();
  const ep = player.current;
  if (!ep) return null;

  return (
    <footer className="player-bar">
      {/* Fine barre de progression (mobile) */}
      <div className="player-bar__line" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />

      <div className="player-bar__info" onClick={onExpand} role="button" tabIndex={0} aria-label="Ouvrir le lecteur">
        <span className="player-bar__art">
          <Artwork src={ep.artwork} alt={ep.podcastTitle} size={56} kind={ep.podcastId.startsWith('quran-') ? 'quran' : 'podcast'} />
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
export function FullPlayer({ onClose }: { onClose: () => void }) {
  const player = usePlayer();
  const { country } = useLibrary();
  const { time } = usePlayerTime();
  const navigate = useNavigate();
  const ep = player.current;
  const podcast = useAsync(() => (ep ? getAnyPodcast(ep.podcastId, country, 200) : Promise.resolve(null)), [ep?.podcastId, country]);
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
    <div className="full-player" role="dialog" aria-modal="true" aria-label="Lecteur">
      <div className="full-player__content">
        <div className="full-player__top">
          <button className="icon-btn" onClick={onClose} aria-label="Fermer le lecteur">
            <ChevronDown size={28} />
          </button>
          <span className="small muted">En cours de lecture</span>
          <button className="icon-btn" onClick={() => go('/queue')} aria-label="File d'attente">
            <ListMusic size={22} />
          </button>
        </div>
        <Artwork
          src={chapter?.img || ep.artwork}
          alt={ep.podcastTitle}
          kind={ep.podcastId.startsWith('quran-') ? 'quran' : 'podcast'}
          className={`full-player__art ${player.isPlaying ? '' : 'full-player__art--paused'}`}
        />
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
        <div className="full-player__extras">
          <RateButton />
          <SleepButton />
          <button className="ctrl-btn" onClick={() => go(`${episodePath(ep)}?clip=1`)} aria-label="Créer un extrait">
            <Scissors size={14} /> Extrait
          </button>
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
