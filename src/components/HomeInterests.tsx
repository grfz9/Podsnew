import { BookOpen, Mic, Newspaper, PlayCircle, Sparkles } from 'lucide-react';
import { ALL_INTERESTS, useLibrary, type Interest } from '../store/library';
import { SHOW_ONBOARDING_EVENT } from './Onboarding';
import { SHOW_WHATS_NEW_EVENT } from './WhatsNew';

const CHOICES: { id: Interest; icon: typeof BookOpen; label: string }[] = [
  { id: 'quran', icon: BookOpen, label: 'Le Coran' },
  { id: 'islamic', icon: Mic, label: 'Podcasts islamiques' },
  { id: 'general', icon: Newspaper, label: 'Podcasts de société' },
];

/** « Mon accueil » (page Moi) : ce que l'accueil met en avant, et accès à la présentation de l'appli. */
export function HomeInterests() {
  const library = useLibrary();
  const interests = library.settings.interests.length ? library.settings.interests : ALL_INTERESTS;
  const toggle = (id: Interest) => {
    const next = interests.includes(id) ? interests.filter((x) => x !== id) : [...interests, id];
    if (next.length) library.setSettings({ interests: next });
  };
  return (
    <section className="home-interests">
      <h2 className="section-title">Mon accueil</h2>
      <div className="home-interests__chips">
        {CHOICES.map(({ id, icon: Icon, label }) => {
          const on = interests.includes(id);
          return (
            <button key={id} className={`adhan__choice ${on ? 'adhan__choice--on' : ''}`} aria-pressed={on} onClick={() => toggle(id)}>
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </div>
      <button className="btn btn--ghost btn--small" onClick={() => window.dispatchEvent(new Event(SHOW_ONBOARDING_EVENT))}>
        <PlayCircle size={15} /> Revoir la présentation de Podsal
      </button>
      <button className="btn btn--ghost btn--small" onClick={() => window.dispatchEvent(new Event(SHOW_WHATS_NEW_EVENT))}>
        <Sparkles size={15} /> Quoi de neuf ?
      </button>
    </section>
  );
}
