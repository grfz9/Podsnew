import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Bell, BookOpen, Check, Download, FolderOpen, Mic, Smartphone } from 'lucide-react';
import { useInstall } from '../lib/install';
import { ALL_INTERESTS, useLibrary, type Interest } from '../store/library';
import { Artwork } from './common';
import { AppMark } from './Wordmark';

/**
 * Présentation de Podsal à la première ouverture : quelques écrans courts et illustrés (glisser ou « Suivant »),
 * « Passer » à tout moment, puis le choix de ce qu'on veut voir à l'accueil.
 * Elle peut être revue depuis « Moi ».
 */

/** Demande d'afficher à nouveau la présentation de l'appli (depuis « Moi »). */
export const SHOW_ONBOARDING_EVENT = 'podsal:onboarding';

const INTERESTS: { id: Interest; icon: typeof BookOpen; title: string; text: string }[] = [
  { id: 'quran', icon: BookOpen, title: 'Le Coran', text: 'Récitations et versets traduits' },
  { id: 'islamic', icon: Mic, title: 'Podcasts islamiques', text: 'Cours, rappels, khoutbas vérifiés' },
];

function VisualWelcome() {
  return (
    <div className="ob-visual ob-visual--welcome">
      <span className="ob-ring" style={{ '--d': 0 } as CSSProperties} />
      <span className="ob-ring" style={{ '--d': 1 } as CSSProperties} />
      <span className="ob-ring" style={{ '--d': 2 } as CSSProperties} />
      <span className="ob-logo">
        <AppMark title="" />
      </span>
    </div>
  );
}

function VisualQuran() {
  return (
    <div className="ob-visual">
      <div className="ob-card ob-verse">
        <span className="ob-verse__n">1</span>
        <p className="ob-verse__ar" lang="ar" dir="rtl">
          ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ
        </p>
        <p className="ob-verse__fr">Louange à Allah, Seigneur de l’univers.</p>
      </div>
      <div className="ob-card ob-verse ob-verse--next">
        <span className="ob-verse__n">2</span>
        <p className="ob-verse__ar" lang="ar" dir="rtl">
          ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
      </div>
    </div>
  );
}

function VisualPrayer() {
  const rows = [
    ['Fajr', '06:12'],
    ['Dhuhr', '13:34'],
    ['Asr', '16:41'],
    ['Maghrib', '19:18'],
    ['Isha', '20:44'],
  ];
  return (
    <div className="ob-visual">
      <div className="ob-card ob-prayers">
        {rows.map(([name, time], i) => (
          <div key={name} className={`ob-prayer ${i === 2 ? 'ob-prayer--next' : ''}`} style={{ '--i': i } as CSSProperties}>
            <span>{name}</span>
            <strong>{time}</strong>
            {i === 2 && <Bell size={14} className="ob-bell" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualListen() {
  return (
    <div className="ob-visual ob-visual--covers">
      {[
        { id: 'ob-1', kind: 'islamic' as const, x: 8, y: 18, r: -8 },
        { id: 'ob-2', kind: 'podcast' as const, genre: 'Histoire', x: 38, y: 4, r: 6 },
        { id: 'ob-3', kind: 'podcast' as const, genre: 'Sciences', x: 54, y: 40, r: -4 },
      ].map((c, i) => (
        <span key={c.id} className="ob-cover" style={{ left: `${c.x}%`, top: `${c.y}%`, '--r': `${c.r}deg`, '--i': i } as CSSProperties}>
          <Artwork alt="" kind={c.kind} podcastId={c.id} genre={c.kind === 'podcast' ? c.genre : undefined} />
        </span>
      ))}
      <span className="ob-badge ob-badge--a">
        <Download size={16} /> Hors-ligne
      </span>
      <span className="ob-badge ob-badge--b">
        <FolderOpen size={16} /> Vos fichiers
      </span>
    </div>
  );
}

interface Slide {
  visual: ReactNode;
  title: string;
  text: string;
}

const SLIDES: Slide[] = [
  { visual: <VisualWelcome />, title: 'Bienvenue sur Podsal', text: 'Podcasts, Coran et rappels, réunis dans une seule appli. Petit tour en 30 secondes.' },
  { visual: <VisualQuran />, title: 'Le Coran, verset par verset', text: 'Écoutez de nombreux récitateurs : les versets défilent avec la traduction de votre choix.' },
  { visual: <VisualPrayer />, title: 'Ne manquez aucune prière', text: 'Horaires pour votre ville, adhan au choix et pause automatique de l’écoute.' },
  { visual: <VisualListen />, title: 'Écoutez partout', text: 'Podcasts vérifiés, téléchargements hors-ligne et vos propres audios ou vidéos, même écran éteint.' },
];

export function Onboarding({ onDone }: { onDone?: () => void }) {
  const library = useLibrary();
  const { mode, install } = useInstall();
  const [index, setIndex] = useState(0);
  const [interests, setInterests] = useState<Interest[]>(library.settings.interests.length ? library.settings.interests : ALL_INTERESTS);
  const last = SLIDES.length; // dernier écran : centres d'intérêt
  const drag = useRef<{ x: number; y: number } | null>(null);

  const finish = (chosen: Interest[] = interests) => {
    library.setSettings({ onboarded: true, interests: chosen.length ? chosen : ALL_INTERESTS });
    onDone?.();
  };
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(last, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: Interest) => setInterests((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <div
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-label="Présentation de Podsal"
      onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const start = drag.current;
        drag.current = null;
        if (!start) return;
        const dx = e.clientX - start.x;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="onboarding__top">
        <span className="onboarding__step">
          {index + 1} / {last + 1}
        </span>
        <button className="btn btn--ghost btn--small" onClick={() => finish()}>
          Passer
        </button>
      </div>

      <div className="onboarding__track" style={{ '--index': index } as CSSProperties}>
        {SLIDES.map((s, i) => (
          <section key={s.title} className={`onboarding__slide ${i === index ? 'is-active' : ''}`} aria-hidden={i !== index}>
            {s.visual}
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </section>
        ))}
        <section className={`onboarding__slide ${index === last ? 'is-active' : ''}`} aria-hidden={index !== last}>
          <h2>Qu’aimeriez-vous écouter ?</h2>
          <p>Votre accueil s’adapte à vos choix. Vous pourrez les changer à tout moment dans « Moi ».</p>
          <div className="ob-interests">
            {INTERESTS.map(({ id, icon: Icon, title, text }) => {
              const on = interests.includes(id);
              return (
                <button key={id} className={`ob-interest ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => toggle(id)} tabIndex={index === last ? 0 : -1}>
                  <span className="ob-interest__icon">
                    <Icon size={20} />
                  </span>
                  <span className="ob-interest__text">
                    <strong>{title}</strong>
                    <span>{text}</span>
                  </span>
                  <span className="ob-interest__check">{on && <Check size={16} />}</span>
                </button>
              );
            })}
          </div>
          {mode === 'prompt' && (
            <button className="btn btn--ghost btn--small ob-install" onClick={() => void install()} tabIndex={index === last ? 0 : -1}>
              <Smartphone size={16} /> Installer l’appli sur cet appareil
            </button>
          )}
        </section>
      </div>

      <div className="onboarding__bottom">
        <div className="onboarding__dots" role="tablist" aria-label="Étapes">
          {Array.from({ length: last + 1 }, (_, i) => (
            <button key={i} role="tab" aria-selected={i === index} aria-label={`Étape ${i + 1}`} className={i === index ? 'on' : ''} onClick={() => go(i)} />
          ))}
        </div>
        {index < last ? (
          <button className="btn btn--primary onboarding__next" onClick={() => go(index + 1)}>
            Suivant <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn btn--primary onboarding__next" onClick={() => finish()} disabled={!interests.length}>
            C’est parti <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
