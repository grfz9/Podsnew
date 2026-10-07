import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Maximize, Minimize, PictureInPicture2 } from 'lucide-react';
import { localUrlFor, localVideoUrlFor } from '../lib/downloads';
import { pipState, usePlayer } from '../store/player';

/** Écart toléré entre l'image et le son avant de recaler la vidéo (en secondes). */
const MAX_DRIFT = 0.3;
/** Délai avant de masquer les commandes en plein écran. */
const HIDE_CONTROLS_MS = 2500;

type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void;
  webkitPresentationMode?: string;
  autoPictureInPicture?: boolean;
};

/** Image dans l'image possible (API standard, ou API de Safari sur iPhone). */
function pipSupported(video: WebkitVideo | null): boolean {
  if (!video) return false;
  return (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function') || !!video.webkitSupportsPresentationMode?.('picture-in-picture');
}

/**
 * Image d'une vidéo importée. Le son vient toujours de l'élément audio du lecteur : il continue
 * en arrière-plan et sur l'écran verrouillé, où les navigateurs coupent les vidéos. La vidéo
 * affichée ici est muette et suit l'audio (lecture, pause, vitesse, position).
 *
 * Un clic met en pause ou relance, un double-clic (ou la touche F) passe en plein écran ;
 * en plein écran, `controls` s'affiche par-dessus l'image et se masque après quelques secondes.
 * Sans plein écran du navigateur (iPhone, certaines WebView Android), la vidéo occupe tout
 * l'écran de l'appli : on garde ainsi nos commandes et le son, que le lecteur du système n'aurait pas.
 */
export function LocalVideo({
  episodeId,
  fallbackSrc,
  title,
  controls,
}: {
  episodeId: string;
  /** Adresse à utiliser si le fichier n'est pas sur l'appareil (fichier publié par un ami). */
  fallbackSrc?: string;
  title: string;
  controls?: ReactNode;
}) {
  const { mediaElement: audio, toggle, isPlaying } = usePlayer();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  const fullscreen = native || pseudo;
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const src = localVideoUrlFor(episodeId) ?? (fallbackSrc || localUrlFor(episodeId) || undefined);

  useEffect(() => {
    const video = videoRef.current;
    if (!audio || !video) return;
    const sync = (force = false) => {
      if (video.readyState === 0 || pipState.active) return;
      if (force || Math.abs(video.currentTime - audio.currentTime) > MAX_DRIFT) video.currentTime = audio.currentTime;
      if (video.playbackRate !== audio.playbackRate) video.playbackRate = audio.playbackRate;
      if (audio.paused && !video.paused) video.pause();
      if (!audio.paused && video.paused) void video.play().catch(() => undefined);
    };
    const onMeta = () => {
      if (video.videoWidth && video.videoHeight) setRatio(video.videoWidth / video.videoHeight);
      sync(true);
    };
    const onForce = () => sync(true);
    const onSoft = () => sync();
    const onVisible = () => document.visibilityState === 'visible' && sync(true);
    video.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onForce);
    audio.addEventListener('pause', onSoft);
    audio.addEventListener('seeked', onForce);
    audio.addEventListener('ratechange', onSoft);
    audio.addEventListener('timeupdate', onSoft);
    document.addEventListener('visibilitychange', onVisible);
    sync(true);
    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onForce);
      audio.removeEventListener('pause', onSoft);
      audio.removeEventListener('seeked', onForce);
      audio.removeEventListener('ratechange', onSoft);
      audio.removeEventListener('timeupdate', onSoft);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [audio, src]);

  /*
   * Image dans l'image : sur iPhone, une vidéo en image dans l'image continue avec le son quand on quitte
   * l'appli ou qu'on éteint l'écran. Le temps qu'elle flotte, c'est elle qui joue le son (le lecteur audio
   * se met en pause et lui passe la main à la même seconde) ; au retour, le lecteur audio reprend.
   */
  const [pip, setPip] = useState(false);
  const [canPip, setCanPip] = useState(false);
  useEffect(() => {
    const video = videoRef.current as WebkitVideo | null;
    if (!video || !audio) return;
    setCanPip(pipSupported(video));
    // Demande à passer seul en image dans l'image quand on quitte l'appli pendant la lecture (si le système l'accepte).
    video.setAttribute('autopictureinpicture', '');
    video.autoPictureInPicture = true;
    const enter = () => {
      if (pipState.active) return;
      pipState.active = true;
      setPip(true);
      const playing = !audio.paused;
      video.currentTime = audio.currentTime;
      video.playbackRate = audio.playbackRate;
      video.volume = audio.volume;
      video.muted = false;
      if (playing) {
        void video.play().catch(() => undefined);
        audio.pause();
      }
    };
    const leave = () => {
      if (!pipState.active) return;
      const playing = !video.paused;
      audio.currentTime = video.currentTime;
      video.muted = true;
      pipState.active = false;
      setPip(false);
      if (playing) void audio.play().catch(() => undefined);
      else video.pause();
    };
    const onWebkit = () => ((video.webkitPresentationMode === 'picture-in-picture' ? enter : leave)());
    video.addEventListener('enterpictureinpicture', enter);
    video.addEventListener('leavepictureinpicture', leave);
    video.addEventListener('webkitpresentationmodechanged', onWebkit);
    return () => {
      video.removeEventListener('enterpictureinpicture', enter);
      video.removeEventListener('leavepictureinpicture', leave);
      video.removeEventListener('webkitpresentationmodechanged', onWebkit);
      if (pipState.active) leave();
    };
  }, [audio, src]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current as WebkitVideo | null;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else if (video.webkitPresentationMode === 'picture-in-picture') video.webkitSetPresentationMode?.('inline');
      else if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
      else video.webkitSetPresentationMode?.('picture-in-picture');
    } catch {
      // refusé par le navigateur
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    clearTimeout(fallbackTimer.current);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else if (pseudo) {
      setPseudo(false);
    } else if (wrapper?.requestFullscreen && document.fullscreenEnabled) {
      void wrapper.requestFullscreen().catch(() => setPseudo(true));
      // Certaines WebView acceptent la demande sans jamais passer en plein écran.
      fallbackTimer.current = setTimeout(() => document.fullscreenElement !== wrapper && setPseudo(true), 700);
    } else {
      setPseudo(true);
    }
  }, [pseudo]);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === wrapperRef.current;
      setNative(on);
      if (on) {
        clearTimeout(fallbackTimer.current);
        setPseudo(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Escape' && pseudo) {
        e.stopPropagation();
        setPseudo(false);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    // Phase de capture : Échap ferme d'abord le plein écran, pas le grand lecteur.
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [toggleFullscreen, pseudo]);

  useEffect(
    () => () => {
      clearTimeout(idleTimer.current);
      clearTimeout(clickTimer.current);
      clearTimeout(fallbackTimer.current);
    },
    [],
  );

  // Commandes visibles au moindre mouvement, masquées ensuite (seulement pendant la lecture).
  const wake = useCallback(() => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), HIDE_CONTROLS_MS);
  }, []);

  // En entrant en plein écran, les commandes s'affichent puis se masquent même sans bouger la souris.
  useEffect(() => {
    if (fullscreen) wake();
  }, [fullscreen, wake]);

  // Un clic : lecture/pause ; deux clics rapprochés : plein écran (sans mettre en pause).
  const onVideoClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = undefined;
      toggleFullscreen();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = undefined;
      toggle();
    }, 250);
  };

  if (!src) return null;
  const hideControls = fullscreen && idle && isPlaying;

  return (
    <div
      ref={wrapperRef}
      className={`local-video ${fullscreen ? 'local-video--fullscreen' : ''} ${pseudo ? 'local-video--pseudo' : ''} ${hideControls ? 'local-video--idle' : ''}`}
      style={{ '--ratio': ratio } as CSSProperties}
      onMouseMove={wake}
      onTouchStart={wake}
    >
      <video ref={videoRef} src={src} muted playsInline preload="auto" aria-label={title} onClick={onVideoClick} />
      {fullscreen && controls && (
        <div className="local-video__overlay" onClick={(e) => e.stopPropagation()}>
          <p className="local-video__title">{title}</p>
          {controls}
        </div>
      )}
      {canPip && (
        <button
          className={`local-video__pip icon-btn ${pip ? 'icon-btn--active' : ''}`}
          onClick={() => void togglePip()}
          aria-label={pip ? 'Revenir dans l’appli' : 'Image dans l’image (écoute hors de l’appli)'}
          title={pip ? 'Revenir dans l’appli' : 'Image dans l’image : la vidéo continue hors de l’appli et écran éteint'}
        >
          <PictureInPicture2 size={18} />
        </button>
      )}
      <button
        className="local-video__fullscreen icon-btn"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        title={fullscreen ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}
      >
        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  );
}
