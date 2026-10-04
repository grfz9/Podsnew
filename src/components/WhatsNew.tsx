import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { CHANGELOG } from '../data/changelog';
import { useLibrary } from '../store/library';

const SEEN_KEY = 'podsal:nouveautes-vues';
export const SHOW_WHATS_NEW_EVENT = 'podsal:nouveautes';

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, CHANGELOG[0].id);
  } catch {
    // stockage indisponible : la fenêtre reviendra, tant pis
  }
}

/**
 * « Quoi de neuf » : s'ouvre une fois après une mise à jour qui apporte des nouveautés
 * (jamais à la toute première visite : le tutoriel suffit), et à la demande depuis « Moi ».
 */
export function WhatsNew() {
  const { settings } = useLibrary();
  const [open, setOpen] = useState<'auto' | 'all' | null>(null);
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    const seen = readSeen();
    if (!settings.onboarded) return; // nouveau venu : le tutoriel d'abord
    if (seen === CHANGELOG[0].id) return;
    setSince(seen);
    setOpen('auto');
  }, [settings.onboarded]);

  useEffect(() => {
    const show = () => {
      setSince(null);
      setOpen('all');
    };
    window.addEventListener(SHOW_WHATS_NEW_EVENT, show);
    return () => window.removeEventListener(SHOW_WHATS_NEW_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!open) return null;
  const close = () => {
    markSeen();
    setOpen(null);
  };
  // Après une mise à jour : les nouveautés depuis la dernière visite (au moins la plus récente).
  const fresh = since ? CHANGELOG.filter((e) => e.id > since) : [];
  const entries = open === 'all' ? CHANGELOG : fresh.length ? fresh : CHANGELOG.slice(0, 1);

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog whats-new" role="dialog" aria-modal="true" aria-labelledby="whats-new-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <h2 id="whats-new-title">
            <Sparkles size={18} /> Quoi de neuf dans Podsal
          </h2>
          <button className="icon-btn" onClick={close} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {entries.map((e) => (
          <section key={e.id} className="whats-new__entry">
            <h3>{e.title}</h3>
            <p className="small muted">{e.date}</p>
            <ul>
              {e.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <button className="btn btn--primary whats-new__ok" onClick={close}>
          Super !
        </button>
      </div>
    </div>
  );
}
