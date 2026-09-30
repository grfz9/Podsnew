import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, Lock } from 'lucide-react';
import { WALLPAPERS, getWallpaper } from '../data/wallpapers';
import { useLibrary } from '../store/library';
import { usePremium } from '../store/premium';

/** Choix du fond d'écran de l'application. */
export function WallpapersPage() {
  const library = useLibrary();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const current = getWallpaper(library.settings.wallpaper).id;

  return (
    <div className="page">
      <h1 className="page__title">Fonds d'écran</h1>
      <p className="muted">
        Motifs géométriques, architecture et paysages, sans représentation d'êtres vivants.{' '}
        {!isPremium && (
          <>
            Les fonds marqués d'un cadenas font partie de{' '}
            <Link to="/premium" className="link">
              Podsal+
            </Link>
            .
          </>
        )}
      </p>
      <div className="wallpaper-grid">
        {WALLPAPERS.map((w, i) => {
          const locked = w.premium && !isPremium;
          const selected = current === w.id;
          return (
            <button
              key={w.id}
              className={`wallpaper-card ${selected ? 'wallpaper-card--selected' : ''}`}
              style={{ '--i': i } as CSSProperties}
              aria-pressed={selected}
              onClick={() => (locked ? navigate('/premium') : library.setSettings({ wallpaper: w.id }))}
            >
              <span className="wallpaper-card__preview" style={{ background: w.background }}>
                <span className="wallpaper-card__mock" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                {selected && (
                  <span className="wallpaper-card__badge">
                    <Check size={14} /> Actif
                  </span>
                )}
                {locked && (
                  <span className="wallpaper-card__badge wallpaper-card__badge--lock">
                    <Lock size={13} /> Podsal+
                  </span>
                )}
              </span>
              <span className="wallpaper-card__name">{w.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
