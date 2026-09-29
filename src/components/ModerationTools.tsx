import { useState } from 'react';
import { EyeOff, ShieldCheck, ShieldOff } from 'lucide-react';
import type { Podcast } from '../types';
import { blockPodcast, unblockPodcast, unvalidatePodcast, validatePodcast } from '../api/moderation';
import { isSeedPodcast, useModeration } from '../store/moderation';

/** Actions de l'administrateur sur un podcast (visible uniquement par lui). */
export function ModerationTools({ podcast, onChange }: { podcast: Podcast; onChange?: () => void }) {
  const moderation = useModeration();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!moderation.isAdmin || podcast.id.startsWith('quran-')) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      moderation.reload();
      onChange?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const validated = moderation.isValidated(podcast.id);
  const blocked = moderation.isBlocked(podcast.id);

  return (
    <section className="moderation-tools">
      <h2 className="panel__title">Modération</h2>
      <div className="row-actions">
        {validated && isSeedPodcast(podcast.id) ? (
          <span className="small muted">Dans la liste de départ : pour le retirer, masquez-le.</span>
        ) : validated ? (
          <button className="btn btn--outline btn--small" disabled={busy} onClick={() => run(() => unvalidatePodcast(podcast.id))}>
            <ShieldOff size={14} /> Retirer des podcasts islamiques
          </button>
        ) : (
          <button className="btn btn--primary btn--small" disabled={busy || blocked} onClick={() => run(() => validatePodcast(podcast))}>
            <ShieldCheck size={14} /> Valider comme podcast islamique
          </button>
        )}
        {blocked ? (
          <button className="btn btn--outline btn--small" disabled={busy} onClick={() => run(() => unblockPodcast(podcast.id))}>
            Rétablir dans le catalogue
          </button>
        ) : (
          <button
            className="btn btn--danger btn--small"
            disabled={busy}
            onClick={() => confirm(`Masquer « ${podcast.title} » pour tous les utilisateurs ?`) && run(() => blockPodcast(podcast))}
          >
            <EyeOff size={14} /> Masquer du catalogue
          </button>
        )}
      </div>
      {error && <p className="small error-text">{error}</p>}
    </section>
  );
}
