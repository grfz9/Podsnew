import { useState } from 'react';
import { Link } from 'react-router';
import { BookOpenCheck, Check, ChevronRight, PartyPopper, RotateCcw, X } from 'lucide-react';
import { getSurah } from '../data/surahs';
import { fromDay, planStatus, portion, ramadanInfo, toDay, type Place, type ReadingPlan } from '../lib/khatma';
import { useLibrary } from '../store/library';
import { toast } from './Toaster';

const placeName = (p: Place) => `${getSurah(p.surah)?.name ?? p.surah} ${p.ayah}`;
const longDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function useReadingPlan() {
  const library = useLibrary();
  const quran = library.settings.quran;
  const setPlan = (plan: ReadingPlan | null) => library.setSettings({ quran: { ...library.settings.quran, plan } });
  return { plan: quran.plan ?? null, setPlan };
}

/** Choix proposés pour commencer un plan (dont « avant Ramadan » et « pendant Ramadan »). */
export function planChoices(now = new Date()): { label: string; days: number; start: string; hint: string }[] {
  const today = toDay(now);
  const choices = [
    { label: '30 jours', days: 30, start: today, hint: 'Environ 1 juz par jour' },
    { label: '60 jours', days: 60, start: today, hint: 'Environ 10 pages par jour' },
    { label: '90 jours', days: 90, start: today, hint: 'Environ 7 pages par jour' },
  ];
  const r = ramadanInfo(now);
  if (r && r.day === null && r.daysUntil >= 7) {
    choices.push({ label: 'Avant Ramadan', days: r.daysUntil, start: today, hint: `Finir avant le ${longDate(r.start)}` });
  }
  if (r) {
    const days = Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000) + 1;
    choices.push({
      label: `Pendant le Ramadan ${r.year}`,
      days: r.day ? days - r.day + 1 : days,
      start: r.day ? today : toDay(r.start),
      hint: r.day ? 'D’aujourd’hui à la fin du mois' : `À partir du ${longDate(r.start)}`,
    });
  }
  return choices;
}

/** Carte du plan de lecture : choix du plan, portion du jour, progression. */
export function ReadingPlanCard({ compact = false }: { compact?: boolean }) {
  const { plan, setPlan } = useReadingPlan();
  const [choosing, setChoosing] = useState(false);

  if (!plan) {
    if (compact) return null;
    return (
      <section className="plan-card" aria-label="Plan de lecture">
        <header className="plan-card__head">
          <span className="plan-card__label">
            <BookOpenCheck size={15} /> Plan de lecture
          </span>
        </header>
        {!choosing ? (
          <>
            <p className="plan-card__title">Lire tout le Coran, un peu chaque jour</p>
            <p className="small muted">Podsal découpe le Coran en portions égales et vous indique chaque jour quoi lire.</p>
            <button className="btn btn--primary btn--small" onClick={() => setChoosing(true)}>
              Commencer un plan
            </button>
          </>
        ) : (
          <div className="plan-choices">
            {planChoices().map((c) => (
              <button key={c.label} className="plan-choice" onClick={() => setPlan({ start: c.start, days: c.days, done: [], label: c.label })}>
                <strong>{c.label}</strong>
                <span className="small muted">
                  {c.days} jours · {c.hint}
                </span>
              </button>
            ))}
            <button className="btn btn--ghost btn--small" onClick={() => setChoosing(false)}>
              Annuler
            </button>
          </div>
        )}
      </section>
    );
  }

  const status = planStatus(plan);
  const markDone = (day: number) => {
    setPlan({ ...plan, done: [...new Set([...plan.done, day])].sort((a, b) => a - b) });
    toast(`Jour ${day + 1} lu, qu’Allah vous récompense`);
  };
  const percent = Math.round(status.progress * 100);

  return (
    <section className={`plan-card ${compact ? 'plan-card--compact' : ''}`} aria-label="Plan de lecture">
      <header className="plan-card__head">
        <span className="plan-card__label">
          <BookOpenCheck size={15} /> Plan de lecture · {plan.label}
        </span>
        <span className="small muted">
          {plan.done.length}/{plan.days} jours · {percent} %
        </span>
      </header>
      <div className="plan-card__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${percent}%` }} />
      </div>

      {status.finished ? (
        <div className="plan-card__done">
          <PartyPopper size={20} />
          <span>Khatma terminée, qu’Allah l’accepte de vous !</span>
          <button className="btn btn--outline btn--small" onClick={() => setPlan(null)}>
            <RotateCcw size={14} /> Nouveau plan
          </button>
        </div>
      ) : !status.started ? (
        <p className="plan-card__title">Votre plan commence le {longDate(fromDay(plan.start))}.</p>
      ) : (
        (() => {
          const p = portion(plan.days, status.next!);
          return (
            <>
              <p className="plan-card__title">
                Jour {status.next! + 1} : {placeName(p.from)} → {placeName(p.to)}
              </p>
              <p className="small muted">
                Pages {p.pages[0]} à {p.pages[1]} du mushaf · {p.ayahs} versets
                {status.due > 1 ? ` · ${status.due} portions à lire pour être à jour` : status.due === 0 ? ' · vous êtes en avance, bravo !' : ''}
              </p>
              <div className="plan-card__actions">
                <Link to={`/lire/${p.from.surah}?v=${p.from.ayah}`} className="btn btn--primary btn--small">
                  Lire <ChevronRight size={14} />
                </Link>
                <button className="btn btn--outline btn--small" onClick={() => markDone(status.next!)}>
                  <Check size={14} /> J’ai lu
                </button>
              </div>
            </>
          );
        })()
      )}
      {!compact && !status.finished && (
        <button className="link-button small muted plan-card__stop" onClick={() => window.confirm('Arrêter ce plan de lecture ?') && setPlan(null)}>
          <X size={12} /> Arrêter le plan
        </button>
      )}
    </section>
  );
}
