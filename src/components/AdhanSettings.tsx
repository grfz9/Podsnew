import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Trash2, Upload } from 'lucide-react';
import {
  DEFAULT_ADHAN_CREDIT,
  deleteCustomAdhan,
  downloadDefaultAdhan,
  getAdhan,
  importCustomAdhan,
  onAdhanChange,
  playAdhan,
  stopAdhan,
  type AdhanChoice,
} from '../lib/adhan';
import { FIVE_PRAYERS, PRAYER_NAMES } from '../lib/prayer';
import type { PrayerSettings } from '../store/library';

const CHOICES: { id: AdhanChoice; label: string }[] = [
  { id: 'off', label: 'Désactivé' },
  { id: 'default', label: `Adhan (${DEFAULT_ADHAN_CREDIT.reciter})` },
  { id: 'custom', label: 'Mon adhan' },
];

/** Réglages de l'adhan (page Prière) : choix du son, aperçu, import et prières concernées. */
export function AdhanSettings({ prayer, set }: { prayer: PrayerSettings; set: (patch: Partial<PrayerSettings>) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getAdhan('custom').then((a) => setCustomName(a?.name ?? null));
    const off = onAdhanChange(setPlaying);
    return () => {
      off();
      stopAdhan();
    };
  }, []);

  const choose = async (choice: AdhanChoice) => {
    setError(null);
    if (choice === 'default') {
      setBusy('Téléchargement de l’adhan sur l’appareil…');
      try {
        await downloadDefaultAdhan();
      } catch (e) {
        setError((e as Error).message);
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    if (choice === 'custom' && !customName) {
      input.current?.click();
      return;
    }
    set({ adhan: choice });
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const stored = await importCustomAdhan(file);
      setCustomName(stored.name);
      set({ adhan: 'custom' });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const removeCustom = async () => {
    stopAdhan();
    await deleteCustomAdhan();
    setCustomName(null);
    if (prayer.adhan === 'custom') set({ adhan: 'off' });
  };

  const preview = async () => {
    if (playing) return stopAdhan();
    if (prayer.adhan === 'off') return;
    setError(null);
    if (!(await playAdhan(prayer.adhan))) setError('Impossible de lire cet adhan sur cet appareil.');
  };

  const togglePrayer = (key: (typeof FIVE_PRAYERS)[number]) => {
    const list = prayer.adhanPrayers as string[];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    set({ adhanPrayers: FIVE_PRAYERS.filter((k) => next.includes(k)) as PrayerSettings['adhanPrayers'] });
  };

  return (
    <div className="adhan">
      <div className="adhan__choices" role="radiogroup" aria-label="Adhan">
        {CHOICES.map((c) => (
          <button
            key={c.id}
            role="radio"
            aria-checked={prayer.adhan === c.id}
            className={`adhan__choice ${prayer.adhan === c.id ? 'adhan__choice--on' : ''}`}
            onClick={() => void choose(c.id)}
            disabled={!!busy}
          >
            {c.label}
          </button>
        ))}
      </div>
      <input
        ref={input}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"
        hidden
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {busy && <p className="small muted">{busy}</p>}
      {error && <p className="small error-text">{error}</p>}

      {prayer.adhan === 'custom' && customName && (
        <div className="adhan__custom">
          <span className="small">
            Fichier : <strong>{customName}</strong>
          </span>
          <span className="row-actions">
            <button className="btn btn--ghost btn--small" onClick={() => input.current?.click()}>
              <Upload size={14} /> Changer
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => void removeCustom()}>
              <Trash2 size={14} /> Supprimer
            </button>
          </span>
        </div>
      )}

      {prayer.adhan !== 'off' && (
        <>
          <button className="btn btn--outline btn--small adhan__preview" onClick={() => void preview()}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Arrêter' : 'Écouter un aperçu'}
          </button>
          <div className="adhan__prayers" aria-label="Prières avec adhan">
            <span className="small muted">Pour les prières :</span>
            {FIVE_PRAYERS.map((k) => {
              const on = (prayer.adhanPrayers as string[]).includes(k);
              return (
                <button key={k} className={`adhan__prayer ${on ? 'adhan__prayer--on' : ''}`} aria-pressed={on} onClick={() => togglePrayer(k as (typeof FIVE_PRAYERS)[number])}>
                  {PRAYER_NAMES[k]}
                </button>
              );
            })}
          </div>
          <p className="small muted">
            L’adhan est joué quand Podsal est ouvert ; la lecture en cours est mise en pause. Ajoutez la notification ci-dessous pour être
            prévenu aussi quand l’appli est en arrière-plan.
          </p>
        </>
      )}
      {prayer.adhan === 'default' && (
        <p className="small muted adhan__credit">
          Adhan récité par {DEFAULT_ADHAN_CREDIT.reciter}, enregistrement de {DEFAULT_ADHAN_CREDIT.author} sur{' '}
          <a href={DEFAULT_ADHAN_CREDIT.source} target="_blank" rel="noreferrer" className="link">
            Wikimedia Commons
          </a>{' '}
          ({DEFAULT_ADHAN_CREDIT.license}).
        </p>
      )}
    </div>
  );
}
