import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { Check, Film, FolderOpen, ListPlus, Music, Pause, Pencil, Play, Trash2, Upload, X } from 'lucide-react';
import { EmptyState, NowPlaying, formatBytes } from '../components/common';
import { ACCEPTED_FILES, type LocalFile } from '../lib/localFiles';
import { useLibrary } from '../store/library';
import { FREE_LOCAL_FILES, useLocalFiles } from '../store/localFiles';
import { usePlayer } from '../store/player';
import { usePremium } from '../store/premium';
import { formatDuration, formatTime } from '../utils/format';

/** Demande au lecteur de s'ouvrir en grand (pour voir une vidéo). */
export const EXPAND_PLAYER_EVENT = 'podsal:expand-player';

/** « Mes fichiers » : audio et vidéo importés depuis l'appareil. */
export function LocalFilesPanel() {
  const local = useLocalFiles();
  const player = usePlayer();
  const library = useLibrary();
  const { isPremium } = usePremium();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const limitReached = local.remaining <= 0;

  const importFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setErrors([]);
    setErrors(await local.importFiles([...list]));
    setBusy(false);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!limitReached && !busy) void importFiles(e.dataTransfer.files);
  };

  const playFile = (file: LocalFile) => {
    const episode = local.episodes.find((e) => e.id === file.id);
    if (!episode) return;
    if (player.current?.id === file.id) player.toggle();
    else player.play(episode);
    if (file.kind === 'video') window.dispatchEvent(new Event(EXPAND_PLAYER_EVENT));
  };

  const remove = async (file: LocalFile) => {
    if (!window.confirm(`Supprimer « ${file.title} » de Podsal ? Le fichier d’origine sur votre appareil n’est pas touché.`)) return;
    if (player.current?.id === file.id) player.pause();
    player.dequeue(file.id);
    await local.remove(file.id);
    setErrors([]);
  };

  const saveTitle = async () => {
    if (editing?.title.trim()) {
      await local.rename(editing.id, editing.title);
      player.retitle(editing.id, editing.title.trim());
    }
    setEditing(null);
  };

  return (
    <section
      className={`local-files ${dragging ? 'local-files--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="local-files__bar">
        <span className="small muted">
          {isPremium
            ? `${local.files.length} fichier${local.files.length > 1 ? 's' : ''} · illimité avec Podsal+`
            : `${local.files.length} / ${FREE_LOCAL_FILES} fichiers`}
        </span>
        <span className="row-actions">
          {local.files.length > 1 && (
            <button className="btn btn--outline btn--small" onClick={() => player.playAll(local.episodes)}>
              <Play size={14} /> Tout lire
            </button>
          )}
          <button className="btn btn--primary btn--small" disabled={busy || limitReached} onClick={() => input.current?.click()}>
            <Upload size={14} /> {busy ? 'Import…' : 'Importer des fichiers'}
          </button>
        </span>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_FILES}
          multiple
          hidden
          onChange={(e) => {
            void importFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {limitReached && !isPremium && (
        <p className="small local-files__limit">
          Vous avez atteint la limite de {FREE_LOCAL_FILES} fichiers.{' '}
          <Link to="/premium" className="link">
            Podsal+
          </Link>{' '}
          permet d’en importer autant que vous voulez.
        </p>
      )}
      {errors.map((message) => (
        <p key={message} className="small error-text">
          {message}
        </p>
      ))}

      {local.loading ? null : local.files.length === 0 ? (
        <EmptyState icon={<FolderOpen size={32} />} title="Aucun fichier">
          Importez un audio (MP3, M4A…) ou une vidéo (MP4…) enregistré sur votre appareil pour l’écouter dans Podsal, même écran éteint.
          {!isPremium && ` Jusqu’à ${FREE_LOCAL_FILES} fichiers sans abonnement.`}
        </EmptyState>
      ) : (
        <ul className="local-files__list">
          {local.files.map((file) => {
            const isCurrent = player.current?.id === file.id;
            const playing = isCurrent && player.isPlaying;
            const progress = library.progress[file.id];
            const Icon = file.kind === 'video' ? Film : Music;
            return (
              <li key={file.id} className={`local-file ${isCurrent ? 'local-file--current' : ''}`}>
                <button className="play-btn" onClick={() => playFile(file)} aria-label={playing ? 'Pause' : `Lire ${file.title}`}>
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <span className={`local-file__icon local-file__icon--${file.kind}`} aria-hidden>
                  <Icon size={20} />
                </span>
                <div className="local-file__body">
                  {editing?.id === file.id ? (
                    <form
                      className="local-file__rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveTitle();
                      }}
                    >
                      <input
                        autoFocus
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                        aria-label="Nouveau titre"
                      />
                      <button className="icon-btn" type="submit" aria-label="Enregistrer le titre">
                        <Check size={18} />
                      </button>
                      <button className="icon-btn" type="button" onClick={() => setEditing(null)} aria-label="Annuler">
                        <X size={18} />
                      </button>
                    </form>
                  ) : (
                    <button className="local-file__title" onClick={() => playFile(file)}>
                      {isCurrent && <NowPlaying paused={!player.isPlaying} />} {file.title}
                    </button>
                  )}
                  <span className="local-file__meta">
                    {file.kind === 'video' ? 'Vidéo' : 'Audio'}
                    {file.duration > 0 && ` · ${formatDuration(file.duration)}`} · {formatBytes(file.size)}
                    {progress?.completed
                      ? ' · Écouté'
                      : progress && progress.position > 0 && ` · Reprise à ${formatTime(progress.position)}`}
                  </span>
                </div>
                <span className="local-file__actions">
                  <button className="icon-btn" onClick={() => player.enqueue(local.episodes.find((e) => e.id === file.id)!)} aria-label="Ajouter à la file d'attente" title="Ajouter à la file d'attente">
                    <ListPlus size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => setEditing({ id: file.id, title: file.title })} aria-label="Renommer" title="Renommer">
                    <Pencil size={18} />
                  </button>
                  <button className="icon-btn" onClick={() => remove(file)} aria-label="Supprimer" title="Supprimer">
                    <Trash2 size={18} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted">
        Les fichiers restent sur cet appareil : ils ne sont envoyés nulle part et ne sont pas synchronisés avec vos autres appareils.
      </p>
    </section>
  );
}

export function LocalFilesPage() {
  return (
    <div className="page">
      <h1 className="page__title">Mes fichiers</h1>
      <p className="muted">Vos propres audios et vidéos, lus comme des épisodes : en arrière-plan, écran verrouillé, à la vitesse de votre choix.</p>
      <LocalFilesPanel />
    </div>
  );
}
