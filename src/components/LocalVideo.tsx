import { useEffect, useRef } from 'react';
import { Maximize } from 'lucide-react';
import { localUrlFor } from '../lib/downloads';
import { usePlayer } from '../store/player';

/** Écart toléré entre l'image et le son avant de recaler la vidéo (en secondes). */
const MAX_DRIFT = 0.3;

/**
 * Image d'une vidéo importée. Le son vient toujours de l'élément audio du lecteur : il continue
 * en arrière-plan et sur l'écran verrouillé, où les navigateurs coupent les vidéos. La vidéo
 * affichée ici est muette et suit l'audio (lecture, pause, vitesse, position).
 */
export function LocalVideo({ episodeId, title }: { episodeId: string; title: string }) {
  const { mediaElement: audio } = usePlayer();
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = localUrlFor(episodeId);

  useEffect(() => {
    const video = videoRef.current;
    if (!audio || !video) return;
    const sync = (force = false) => {
      if (video.readyState === 0) return;
      if (force || Math.abs(video.currentTime - audio.currentTime) > MAX_DRIFT) video.currentTime = audio.currentTime;
      if (video.playbackRate !== audio.playbackRate) video.playbackRate = audio.playbackRate;
      if (audio.paused && !video.paused) video.pause();
      if (!audio.paused && video.paused) void video.play().catch(() => undefined);
    };
    const onForce = () => sync(true);
    const onSoft = () => sync();
    const onVisible = () => document.visibilityState === 'visible' && sync(true);
    video.addEventListener('loadedmetadata', onForce);
    audio.addEventListener('play', onForce);
    audio.addEventListener('pause', onSoft);
    audio.addEventListener('seeked', onForce);
    audio.addEventListener('ratechange', onSoft);
    audio.addEventListener('timeupdate', onSoft);
    document.addEventListener('visibilitychange', onVisible);
    sync(true);
    return () => {
      video.removeEventListener('loadedmetadata', onForce);
      audio.removeEventListener('play', onForce);
      audio.removeEventListener('pause', onSoft);
      audio.removeEventListener('seeked', onForce);
      audio.removeEventListener('ratechange', onSoft);
      audio.removeEventListener('timeupdate', onSoft);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [audio, src]);

  if (!src) return null;
  const fullscreen = () => {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!video) return;
    if (video.requestFullscreen) void video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.();
  };

  return (
    <div className="local-video">
      <video ref={videoRef} src={src} muted playsInline preload="auto" aria-label={title} />
      <button className="local-video__fullscreen icon-btn" onClick={fullscreen} aria-label="Plein écran" title="Plein écran">
        <Maximize size={18} />
      </button>
    </div>
  );
}
