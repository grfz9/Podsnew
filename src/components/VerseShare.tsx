import { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Share2, X } from 'lucide-react';
import { TRANSLATIONS, type TranslationId } from '../api/quran';
import { getSurah } from '../data/surahs';
import { renderVerseCard, shareImage } from '../lib/verseCard';
import { Spinner } from './common';

export interface SharedVerse {
  surah: number;
  ayah: number;
  arabic: string;
  translation?: string;
  translationId?: TranslationId;
}

const TRANSLATOR: Record<TranslationId, string> = {
  hamidullah: 'Trad. Muhammad Hamidullah (Complexe du Roi Fahd)',
  rashid: 'Trad. Rachid Maach (Rowwad at-Tarjama)',
};

/** Aperçu de la carte image d'un verset, à partager (téléphone) ou enregistrer (ordinateur). */
export function VerseShareDialog({ verse, onClose }: { verse: SharedVerse; onClose: () => void }) {
  const s = getSurah(verse.surah)!;
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  // Partage de fichiers (téléphones) ; sinon l'image est enregistrée (ordinateurs).
  const canShareFiles = !!navigator.canShare?.({ files: [new File([''], 'verset.png', { type: 'image/png' })] });

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    renderVerseCard({
      arabic: verse.arabic,
      translation: verse.translation,
      reference: `${s.name} · ${verse.surah}:${verse.ayah}`,
      translator: verse.translation && verse.translationId ? TRANSLATOR[verse.translationId] : undefined,
    })
      .then((b) => {
        if (cancelled) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse.surah, verse.ayah, verse.arabic, verse.translation, verse.translationId, s.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async () => {
    if (!blob) return;
    const result = await shareImage(blob, `podsal-${verse.surah}-${verse.ayah}.png`, `${s.name} ${verse.surah}:${verse.ayah} — via Podsal : podsal.com`);
    setStatus(result === 'downloaded' ? 'Image enregistrée dans vos téléchargements.' : result === 'shared' ? 'Partagé !' : null);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog verse-share" role="dialog" aria-modal="true" aria-label="Partager le verset en image" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <h2>
            <ImageIcon size={18} /> Partager en image
          </h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="verse-share__preview">{url ? <img src={url} alt={`${s.name}, verset ${verse.ayah}`} /> : error ? <p className="small error-text">{error}</p> : <Spinner label="Création de l’image…" />}</div>
        {verse.translation && verse.translationId && (
          <p className="small muted">{TRANSLATIONS.find((t) => t.id === verse.translationId)?.source}</p>
        )}
        <button className="btn btn--primary verse-share__go" onClick={() => void act()} disabled={!blob}>
          {canShareFiles ? <Share2 size={16} /> : <Download size={16} />} {canShareFiles ? 'Partager' : 'Enregistrer l’image'}
        </button>
        {status && <p className="small ok-text">{status}</p>}
      </div>
    </div>
  );
}
