import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Download, X } from 'lucide-react';
import { DESKTOP_DOWNLOADS, isNewerVersion, latestDesktopVersion, manualDesktopVersion } from '../lib/install';

const DISMISS_KEY = 'podsal:maj-appli-ignoree';

/**
 * Bandeau dans l'appli pour ordinateur quand une nouvelle version existe et qu'elle ne peut pas
 * s'installer seule (versions 1.0.0, Mac). Les autres versions se mettent à jour automatiquement.
 */
export function DesktopUpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  const installed = manualDesktopVersion();

  useEffect(() => {
    if (!installed) return;
    let dismissed: string | null = null;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY);
    } catch {
      // stockage indisponible
    }
    void latestDesktopVersion().then((v) => {
      if (v && isNewerVersion(v, installed) && v !== dismissed) setLatest(v);
    });
  }, [installed]);

  if (!latest) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, latest);
    } catch {
      // tant pis
    }
    setLatest(null);
  };
  const isWindows = /Windows/.test(navigator.userAgent);

  return (
    <div className="update-banner" role="status">
      <Download size={16} />
      <span>
        La version <strong>{latest}</strong> de l’appli Podsal est disponible{isWindows ? ' : installez-la par-dessus, elle se mettra ensuite à jour toute seule.' : '.'}
      </span>
      {isWindows ? (
        <a className="btn btn--primary btn--small" href={DESKTOP_DOWNLOADS.windows.files[0].url} target="_blank" rel="noreferrer">
          Télécharger
        </a>
      ) : (
        <Link className="btn btn--primary btn--small" to="/telecharger">
          Télécharger
        </Link>
      )}
      <button className="icon-btn" onClick={dismiss} aria-label="Plus tard" title="Plus tard">
        <X size={16} />
      </button>
    </div>
  );
}
