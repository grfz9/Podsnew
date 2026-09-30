import { useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, ImagePlus, Lock, Trash2 } from 'lucide-react';
import { Tabs } from '../components/common';
import { CUSTOM_WALLPAPER_ID, SIDEBAR_WALLPAPERS, WALLPAPERS, customBackground, resolveBackground, sidebarBackground } from '../data/wallpapers';
import { useCustomImages, type WallpaperSlot } from '../store/customImages';
import { useLibrary } from '../store/library';
import { usePremium } from '../store/premium';

const SETTING = { main: 'wallpaper', sidebar: 'sidebarWallpaper' } as const;

/** Choix du fond d'écran de l'application et du menu de gauche. */
export function WallpapersPage() {
  const library = useLibrary();
  const { isPremium } = usePremium();
  const images = useCustomImages();
  const navigate = useNavigate();
  const [slot, setSlot] = useState<WallpaperSlot>('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const settingKey = SETTING[slot];
  const current = resolveBackground(slot, library.settings[settingKey], isPremium, images.wallpaperUrl(slot)).id;
  const list = slot === 'main' ? WALLPAPERS : SIDEBAR_WALLPAPERS;
  const customUrl = images.wallpaperUrl(slot);
  const preview = (background: string) => (slot === 'sidebar' ? sidebarBackground(background) : background);
  const choose = (id: string) => library.setSettings(slot === 'main' ? { wallpaper: id } : { sidebarWallpaper: id });

  const importImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await images.setWallpaper(slot, file);
      choose(CUSTOM_WALLPAPER_ID);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    await images.setWallpaper(slot, null);
    if (library.settings[settingKey] === CUSTOM_WALLPAPER_ID) choose(slot === 'main' ? 'halo' : 'uni');
  };

  const onCustomClick = () => {
    if (!isPremium) navigate('/premium');
    else if (customUrl && current !== CUSTOM_WALLPAPER_ID) choose(CUSTOM_WALLPAPER_ID);
    else fileInput.current?.click();
  };

  return (
    <div className="page">
      <h1 className="page__title">Fonds d'écran</h1>
      <p className="muted">
        Motifs géométriques, architecture et paysages, sans représentation d'êtres vivants.{' '}
        {!isPremium && (
          <>
            Les fonds marqués d'un cadenas et l'import de votre propre image font partie de{' '}
            <Link to="/premium" className="link">
              Podsal+
            </Link>
            .
          </>
        )}
      </p>
      <Tabs
        tabs={[
          { id: 'main', label: 'Page principale' },
          { id: 'sidebar', label: 'Menu de gauche' },
        ]}
        value={slot}
        onChange={(s) => {
          setSlot(s);
          setError(null);
        }}
      />
      {slot === 'sidebar' && <p className="small muted">Le menu de gauche s'affiche sur ordinateur et tablette en mode paysage.</p>}

      <div className={`wallpaper-grid ${slot === 'sidebar' ? 'wallpaper-grid--sidebar' : ''}`}>
        {list.map((w, i) => {
          const locked = w.premium && !isPremium;
          const selected = current === w.id;
          return (
            <button
              key={w.id}
              className={`wallpaper-card ${selected ? 'wallpaper-card--selected' : ''}`}
              style={{ '--i': i } as CSSProperties}
              aria-pressed={selected}
              onClick={() => (locked ? navigate('/premium') : choose(w.id))}
            >
              <span className="wallpaper-card__preview" style={{ background: preview(w.background) }}>
                <Mock />
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

        <button
          className={`wallpaper-card ${current === CUSTOM_WALLPAPER_ID ? 'wallpaper-card--selected' : ''}`}
          style={{ '--i': list.length } as CSSProperties}
          aria-pressed={current === CUSTOM_WALLPAPER_ID}
          onClick={onCustomClick}
          disabled={busy}
        >
          <span
            className="wallpaper-card__preview wallpaper-card__preview--custom"
            style={customUrl ? { background: preview(customBackground(customUrl)) } : undefined}
          >
            {customUrl ? (
              <Mock />
            ) : (
              <span className="wallpaper-card__import">
                <ImagePlus size={28} />
                {busy ? 'Import…' : 'Importer une image'}
              </span>
            )}
            {current === CUSTOM_WALLPAPER_ID && (
              <span className="wallpaper-card__badge">
                <Check size={14} /> Actif
              </span>
            )}
            {!isPremium && (
              <span className="wallpaper-card__badge wallpaper-card__badge--lock">
                <Lock size={13} /> Podsal+
              </span>
            )}
          </span>
          <span className="wallpaper-card__name">Votre image</span>
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void importImage(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {isPremium && customUrl && (
        <div className="wallpaper-actions">
          <button className="btn btn--outline btn--small" disabled={busy} onClick={() => fileInput.current?.click()}>
            <ImagePlus size={15} /> Changer d'image
          </button>
          <button className="btn btn--ghost btn--small" disabled={busy} onClick={removeImage}>
            <Trash2 size={15} /> Supprimer l'image
          </button>
        </div>
      )}
      {error && <p className="small error-text">{error}</p>}
      <p className="small muted">Votre image reste sur cet appareil : elle n'est envoyée nulle part.</p>
    </div>
  );
}

function Mock() {
  return (
    <span className="wallpaper-card__mock" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}
