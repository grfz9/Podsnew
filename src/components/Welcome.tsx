import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { BookOpen, Clock, Download, Mic, Share, Smartphone, X } from 'lucide-react';
import { useInstall } from '../lib/install';
import { Artwork } from './common';

const KEY = 'podsal:welcome-hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

const FEATURES = [
  { icon: BookOpen, title: 'Le Coran récité', text: 'Sourate par sourate, par de nombreux récitateurs, avec traduction.' },
  { icon: Clock, title: 'Horaires de prière', text: 'Calculés pour votre ville, avec pause de la lecture à l’adhan.' },
  { icon: Mic, title: 'Podcasts vérifiés', text: 'Podcasts islamiques validés un par un, et podcasts de parole.' },
  { icon: Download, title: 'Partout, même hors-ligne', text: 'Téléchargements, vos propres audios et vidéos, écran éteint.' },
];

/** Couvertures décoratives qui flottent dans la carte (motifs de l'appli, aucune image). */
const DECOR = [
  { kind: 'quran' as const, id: 'quran-decor', x: '6%', y: '4%', size: 150, r: -8 },
  { kind: 'islamic' as const, id: 'decor-1', x: '58%', y: '0%', size: 118, r: 8 },
  { kind: 'podcast' as const, id: 'decor-2', genre: 'Humour', x: '28%', y: '50%', size: 132, r: 6 },
  { kind: 'podcast' as const, id: 'decor-5', genre: 'Sciences', x: '72%', y: '58%', size: 100, r: -10 },
];

/**
 * Accueil des nouveaux visiteurs (aucune écoute ni abonnement) : présente Podsal en un coup d'œil
 * et propose de l'installer. Peut être masqué ; il disparaît aussi dès la première écoute.
 */
export function Welcome() {
  const [hidden, setHidden] = useState(readHidden);
  const [iosHelp, setIosHelp] = useState(false);
  const { mode, install } = useInstall();
  if (hidden) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* stockage indisponible : la carte reviendra au prochain chargement */
    }
  };

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <button className="icon-btn welcome__close" onClick={hide} aria-label="Masquer la présentation" title="Masquer">
        <X size={18} />
      </button>
      <div className="welcome__decor" aria-hidden>
        {DECOR.map((d, i) => (
          <span key={d.id} className="welcome__cover" style={{ left: d.x, top: d.y, width: d.size, height: d.size, '--r': `${d.r}deg`, '--i': i } as CSSProperties}>
            <Artwork alt="" kind={d.kind} podcastId={d.id} genre={d.kind === 'podcast' ? d.genre : undefined} />
          </span>
        ))}
      </div>
      <div className="welcome__body">
        <span className="welcome__kicker">Bienvenue sur Podsal</span>
        <h2 id="welcome-title" className="welcome__title">
          Podcasts, Coran et rappels, <span>réunis.</span>
        </h2>
        <p className="welcome__text">Une seule appli pour écouter ce qui vous fait du bien, chez vous, en voiture ou hors-ligne.</p>
        <ul className="welcome__features">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <li key={title} style={{ '--i': i } as CSSProperties}>
              <span className="welcome__icon">
                <Icon size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <span>{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="welcome__actions">
          <Link to="/coran" className="btn btn--primary">
            <BookOpen size={16} /> Écouter le Coran
          </Link>
          <Link to="/search" className="btn btn--outline">
            Explorer les podcasts
          </Link>
          {mode === 'prompt' && (
            <button className="btn btn--ghost" onClick={() => void install()}>
              <Smartphone size={16} /> Installer l’appli
            </button>
          )}
          {mode === 'ios' && (
            <button className="btn btn--ghost" onClick={() => setIosHelp((v) => !v)} aria-expanded={iosHelp}>
              <Smartphone size={16} /> Installer sur l’iPhone
            </button>
          )}
        </div>
        {iosHelp && (
          <p className="small welcome__ios">
            Dans Safari, touchez <Share size={14} aria-label="Partager" /> <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong> : Podsal
            s’ouvrira comme une appli, en plein écran.
          </p>
        )}
      </div>
    </section>
  );
}
