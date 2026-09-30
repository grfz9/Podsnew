import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowUp, Check, Film, Folder, FolderPlus, Globe, Lock, Music, Pause, Pencil, Play, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { deleteSharedGroup, MAX_SHARED_FILE_BYTES, publishGroup } from '../api/sharedGroups';
import { isPublicationOutdated, type FileGroup, type LocalFile } from '../lib/localFiles';
import { useAuth } from '../store/auth';
import { useLocalFiles } from '../store/localFiles';
import { usePlayer } from '../store/player';
import { usePremium } from '../store/premium';
import { formatDuration } from '../utils/format';
import { EmptyState, NowPlaying, formatBytes } from './common';
import { expandPlayerFor, usePlayLocal } from './playLocal';

/** Groupes de « Mes fichiers » : rangement sur l'appareil, et publication pour les amis (Podsal+). */
export function FileGroups() {
  const local = useLocalFiles();
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const open = local.groups.find((g) => g.id === openId);

  if (open) return <GroupDetail group={open} onBack={() => setOpenId(null)} />;

  return (
    <section className="file-groups">
      <form
        className="file-groups__new"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const group = local.createGroup(name);
          setName('');
          setOpenId(group.id);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du nouveau groupe (ex. Tafsir, Rappels…)" maxLength={80} aria-label="Nom du nouveau groupe" />
        <button className="btn btn--primary btn--small" type="submit" disabled={!name.trim()}>
          <FolderPlus size={14} /> Créer le groupe
        </button>
      </form>

      {local.groups.length === 0 ? (
        <EmptyState icon={<Folder size={32} />} title="Aucun groupe">
          Rangez vos audios et vidéos ensemble (une série de cours, des rappels…) et lisez-les à la suite. Avec Podsal+, vous pouvez publier un groupe
          sur votre profil pour vos amis.
        </EmptyState>
      ) : (
        <ul className="file-groups__list">
          {local.groups.map((g) => (
            <GroupCard key={g.id} group={g} onOpen={() => setOpenId(g.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function groupFiles(group: FileGroup, files: LocalFile[]): LocalFile[] {
  const byId = new Map(files.map((f) => [f.id, f]));
  return group.fileIds.map((id) => byId.get(id)).filter((f): f is LocalFile => !!f);
}

function GroupCard({ group, onOpen }: { group: FileGroup; onOpen: () => void }) {
  const local = useLocalFiles();
  const player = usePlayer();
  const files = groupFiles(group, local.files);
  const duration = files.reduce((sum, f) => sum + f.duration, 0);
  const playAll = () => {
    const episodes = files.map((f) => local.episodes.find((e) => e.id === f.id)!).filter(Boolean);
    if (!episodes.length) return;
    player.playAll(episodes);
    expandPlayerFor(episodes[0]);
  };
  return (
    <li className="file-group">
      <button className="play-btn" onClick={playAll} disabled={!files.length} aria-label={`Lire le groupe ${group.name}`}>
        <Play size={18} fill="currentColor" />
      </button>
      <button className="file-group__body" onClick={onOpen}>
        <span className="file-group__name">
          <Folder size={16} /> {group.name}
        </span>
        <span className="local-file__meta">
          {files.length} fichier{files.length > 1 ? 's' : ''}
          {duration > 0 && ` · ${formatDuration(duration)}`}
        </span>
      </button>
      <span className={`file-group__badge ${group.remoteId ? 'file-group__badge--public' : ''}`}>
        {group.remoteId ? (
          <>
            <Users size={13} /> {isPublicationOutdated(group) ? 'Amis · à mettre à jour' : 'Visible par mes amis'}
          </>
        ) : (
          <>
            <Lock size={13} /> Privé
          </>
        )}
      </span>
    </li>
  );
}

function GroupDetail({ group, onBack }: { group: FileGroup; onBack: () => void }) {
  const local = useLocalFiles();
  const player = usePlayer();
  const playFile = usePlayLocal();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const files = groupFiles(group, local.files);
  const others = local.files.filter((f) => !group.fileIds.includes(f.id));

  const playAll = () => {
    const episodes = files.map((f) => local.episodes.find((e) => e.id === f.id)!).filter(Boolean);
    if (!episodes.length) return;
    player.playAll(episodes);
    expandPlayerFor(episodes[0]);
  };

  const remove = async () => {
    const message = group.remoteId
      ? `Supprimer le groupe « ${group.name} » ? Il ne sera plus visible par vos amis et ses fichiers seront retirés du serveur. Les fichiers restent dans Mes fichiers.`
      : `Supprimer le groupe « ${group.name} » ? Les fichiers restent dans Mes fichiers.`;
    if (!window.confirm(message)) return;
    if (group.remoteId) {
      try {
        await deleteSharedGroup(group.remoteId);
      } catch (e) {
        window.alert(`La publication n’a pas pu être retirée : ${(e as Error).message}`);
        return;
      }
    }
    local.deleteGroup(group.id);
    onBack();
  };

  return (
    <section className="file-group-detail">
      <button className="link-button muted small" onClick={onBack}>
        <ArrowLeft size={14} /> Tous les groupes
      </button>

      <div className="file-group-detail__head">
        {renaming !== null ? (
          <form
            className="local-file__rename"
            onSubmit={(e) => {
              e.preventDefault();
              local.renameGroup(group.id, renaming);
              setRenaming(null);
            }}
          >
            <input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} maxLength={80} aria-label="Nom du groupe" onKeyDown={(e) => e.key === 'Escape' && setRenaming(null)} />
            <button className="icon-btn" type="submit" aria-label="Enregistrer le nom">
              <Check size={18} />
            </button>
            <button className="icon-btn" type="button" onClick={() => setRenaming(null)} aria-label="Annuler">
              <X size={18} />
            </button>
          </form>
        ) : (
          <h2 className="file-group-detail__title">
            <Folder size={22} /> {group.name}
            <button className="icon-btn" onClick={() => setRenaming(group.name)} aria-label="Renommer le groupe" title="Renommer le groupe">
              <Pencil size={16} />
            </button>
          </h2>
        )}
        <span className="row-actions">
          <button className="btn btn--primary btn--small" onClick={playAll} disabled={!files.length}>
            <Play size={14} /> Tout lire
          </button>
          <button className={`btn btn--outline btn--small ${adding ? 'btn--active' : ''}`} onClick={() => setAdding((v) => !v)} disabled={!others.length && !adding}>
            <FolderPlus size={14} /> Ajouter des fichiers
          </button>
          <button className="btn btn--ghost btn--small" onClick={remove}>
            <Trash2 size={14} /> Supprimer le groupe
          </button>
        </span>
      </div>

      <Publication group={group} files={files} />

      {adding && (
        <div className="file-group-detail__add">
          <p className="small muted">Cochez les fichiers à ajouter :</p>
          {others.map((f) => (
            <label key={f.id} className="group-picker__item">
              <input type="checkbox" checked={false} onChange={() => local.toggleInGroup(group.id, f.id)} />
              {f.kind === 'video' ? <Film size={14} /> : <Music size={14} />}
              <span>{f.title}</span>
            </label>
          ))}
          {!others.length && <p className="small muted">Tous vos fichiers sont déjà dans ce groupe.</p>}
        </div>
      )}

      {files.length === 0 ? (
        <EmptyState icon={<Folder size={32} />} title="Groupe vide">
          Ajoutez des fichiers avec le bouton ci-dessus, ou depuis l’onglet Fichiers.
        </EmptyState>
      ) : (
        <ol className="local-files__list">
          {files.map((file, i) => {
            const isCurrent = player.current?.id === file.id;
            const playing = isCurrent && player.isPlaying;
            return (
              <li key={file.id} className={`local-file ${isCurrent ? 'local-file--current' : ''}`}>
                <button className="play-btn" onClick={() => playFile(file)} aria-label={playing ? 'Pause' : `Lire ${file.title}`}>
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <div className="local-file__body">
                  <button className="local-file__title" onClick={() => playFile(file)}>
                    {isCurrent && <NowPlaying paused={!player.isPlaying} />} {i + 1}. {file.title}
                  </button>
                  <span className="local-file__meta">
                    {file.kind === 'video' ? 'Vidéo' : 'Audio'}
                    {file.duration > 0 && ` · ${formatDuration(file.duration)}`} · {formatBytes(file.size)}
                    {group.remoteId && file.size > MAX_SHARED_FILE_BYTES && ' · trop lourd pour être publié (50 Mo max)'}
                  </span>
                </div>
                <span className="local-file__actions local-file__actions--group">
                  <button className="icon-btn" onClick={() => local.moveInGroup(group.id, i, i - 1)} disabled={i === 0} aria-label="Monter" title="Monter">
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => local.moveInGroup(group.id, i, i + 1)} disabled={i === files.length - 1} aria-label="Descendre" title="Descendre">
                    <ArrowDown size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => local.toggleInGroup(group.id, file.id)} aria-label="Retirer du groupe" title="Retirer du groupe (le fichier reste dans Mes fichiers)">
                    <X size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Publication du groupe sur le profil, visible par les amis mutuels (Podsal+). */
function Publication({ group, files }: { group: FileGroup; files: LocalFile[] }) {
  const local = useLocalFiles();
  const auth = useAuth();
  const { isPremium } = usePremium();
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const outdated = isPublicationOutdated(group);

  const publish = async () => {
    if (!auth.userId) return;
    setMessages([]);
    setBusy('Préparation…');
    try {
      const result = await publishGroup(auth.userId, group, files, (done, total) => setBusy(`Envoi des fichiers : ${done} / ${total}`));
      local.setPublished(group.id, result.remoteId);
      setMessages(result.skipped);
    } catch (e) {
      setMessages([(e as Error).message]);
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    if (!group.remoteId) return;
    if (!window.confirm('Rendre ce groupe privé ? Vos amis ne le verront plus et ses fichiers seront retirés du serveur (ils restent sur cet appareil).')) return;
    setBusy('Retrait de la publication…');
    try {
      await deleteSharedGroup(group.remoteId);
      local.setPublished(group.id, undefined);
      setMessages([]);
    } catch (e) {
      setMessages([(e as Error).message]);
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (!auth.enabled || !auth.userId) {
    body = (
      <p className="small muted">
        <Link to="/account" className="link">
          Connectez-vous
        </Link>{' '}
        pour publier ce groupe sur votre profil.
      </p>
    );
  } else if (!isPremium && !group.remoteId) {
    body = (
      <p className="small muted">
        <Lock size={13} /> Publier un groupe pour vos amis fait partie de{' '}
        <Link to="/premium" className="link">
          Podsal+
        </Link>
        .
      </p>
    );
  } else if (group.remoteId) {
    body = (
      <>
        <p className="small">
          <Users size={14} /> <strong>Visible par vos amis</strong> sur{' '}
          {auth.profile?.username ? (
            <Link to={`/u/${auth.profile.username}`} className="link">
              votre profil
            </Link>
          ) : (
            'votre profil'
          )}
          .{outdated && ' Vous avez modifié ce groupe depuis : mettez la publication à jour pour que vos amis voient les changements.'}
        </p>
        <span className="row-actions">
          {outdated && isPremium && (
            <button className="btn btn--primary btn--small" onClick={publish} disabled={!!busy}>
              <RefreshCw size={14} /> Mettre à jour la publication
            </button>
          )}
          <button className="btn btn--outline btn--small" onClick={unpublish} disabled={!!busy}>
            <Lock size={14} /> Rendre privé
          </button>
        </span>
      </>
    );
  } else {
    body = (
      <>
        <p className="small muted">
          Privé : visible uniquement sur cet appareil. Publiez-le pour que vos amis puissent l’écouter depuis votre profil (fichiers de 50 Mo au plus).
        </p>
        <button className="btn btn--primary btn--small" onClick={publish} disabled={!!busy || !files.length}>
          <Globe size={14} /> Publier pour mes amis
        </button>
      </>
    );
  }

  return (
    <div className="file-group-publication">
      {body}
      {busy && <p className="small muted">{busy}</p>}
      {messages.map((m) => (
        <p key={m} className="small error-text">
          {m}
        </p>
      ))}
    </div>
  );
}
