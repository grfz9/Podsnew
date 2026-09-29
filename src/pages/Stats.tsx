import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChartColumn, Share2 } from 'lucide-react';
import { BarChart, RankedBars } from '../components/BarChart';
import { Artwork, EmptyState, Tabs, shareText } from '../components/common';
import { dayKey, summarize, type StatsSummary } from '../lib/stats';
import { useLibrary } from '../store/library';
import { podcastPath } from '../lib/paths';

type PeriodId = 'year' | 'month' | 'all';

/** Initiales sous l'axe (le nom complet est dans l'info-bulle et le tableau). */
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** 5400 → « 1 h 30 », 600 → « 10 min » */
export function formatListening(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h.toLocaleString('fr-FR')} h ${String(m).padStart(2, '0')}` : `${h.toLocaleString('fr-FR')} h`;
}

function axisMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 120) return `${minutes} min`;
  return seconds % 3600 === 0 ? `${seconds / 3600} h` : formatListening(seconds);
}

/** Graduations en heures rondes au-delà de 2 h, sinon en minutes. */
function timeUnit(maxSeconds: number): number {
  return maxSeconds >= 7200 ? 3600 : 60;
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <span className="tile__value">{value}</span>
      {detail && <span className="tile__detail">{detail}</span>}
    </div>
  );
}

function favouriteMoment(hours: number[]): string | null {
  const slots = [
    { name: 'la nuit (0 h – 6 h)', from: 0, to: 6 },
    { name: 'le matin (6 h – 12 h)', from: 6, to: 12 },
    { name: "l'après-midi (12 h – 18 h)", from: 12, to: 18 },
    { name: 'le soir (18 h – 24 h)', from: 18, to: 24 },
  ].map((s) => ({ ...s, total: hours.slice(s.from, s.to).reduce((a, b) => a + b, 0) }));
  const best = slots.sort((a, b) => b.total - a.total)[0];
  return best.total > 0 ? best.name : null;
}

function yearRecap(year: number, s: StatsSummary): string {
  const top = s.podcasts[0];
  const genre = s.genres[0];
  const moment = favouriteMoment(s.hours);
  return [
    `En ${year}, j'ai écouté ${formatListening(s.totalSeconds)} de podcasts sur ${s.activeDays} jours, et terminé ${s.completed} épisodes.`,
    top ? `Podcast le plus écouté : ${top.item.title} (${formatListening(top.seconds)}).` : '',
    genre ? `Catégorie préférée : ${genre.item}.` : '',
    moment ? `Moment préféré pour écouter : ${moment}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function StatsPage() {
  const library = useLibrary();
  const [period, setPeriod] = useState<PeriodId>('year');
  const [notice, setNotice] = useState<string | null>(null);
  const now = new Date();
  const year = now.getFullYear();

  const range: { from?: string; to?: string } =
    period === 'year'
      ? { from: `${year}-01-01`, to: `${year}-12-31` }
      : period === 'month'
        ? { from: dayKey(new Date(year, now.getMonth(), 1)), to: dayKey(new Date(year, now.getMonth() + 1, 0)) }
        : {};

  const s = useMemo(() => summarize(library.state.stats, { from: range.from, to: range.to }), [library.state.stats, range.from, range.to]);
  const all = useMemo(() => summarize(library.state.stats), [library.state.stats]);

  if (all.totalSeconds < 60) {
    return (
      <div className="page">
        <h1 className="page__title">Statistiques d'écoute</h1>
        <EmptyState icon={<ChartColumn size={32} />} title="Pas encore de statistiques">
          Le temps passé à écouter est compté automatiquement, sur cet appareil et sur ceux où vous êtes connecté.
        </EmptyState>
      </div>
    );
  }

  const bars =
    period === 'month'
      ? Array.from({ length: new Date(year, now.getMonth() + 1, 0).getDate() }, (_, i) => {
          const key = dayKey(new Date(year, now.getMonth(), i + 1));
          return { label: String(i + 1), name: `${i + 1} ${MONTHS_LONG[now.getMonth()]}`, value: s.byDay.find((d) => d.day === key)?.seconds ?? 0 };
        })
      : period === 'year'
        ? s.byMonth.map((value, i) => ({ label: MONTHS[i], name: `${MONTHS_LONG[i]} ${year}`, value }))
        : Array.from({ length: 12 }, (_, i) => {
            const d = new Date(year, now.getMonth() - 11 + i, 1);
            const prefix = dayKey(d).slice(0, 7);
            const value = all.byDay.filter((x) => x.day.startsWith(prefix)).reduce((sum, x) => sum + x.seconds, 0);
            return { label: MONTHS[d.getMonth()], name: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`, value };
          });

  const periodLabel = period === 'year' ? `en ${year}` : period === 'month' ? `en ${MONTHS_LONG[now.getMonth()]}` : 'depuis le début';
  const yearSummary = period === 'year' ? s : summarize(library.state.stats, { from: `${year}-01-01`, to: `${year}-12-31` });

  return (
    <div className="page">
      <h1 className="page__title">Statistiques d'écoute</h1>
      <Tabs
        tabs={[
          { id: 'year', label: `Année ${year}` },
          { id: 'month', label: MONTHS_LONG[now.getMonth()].replace(/^./, (c) => c.toUpperCase()) },
          { id: 'all', label: 'Depuis le début' },
        ]}
        value={period}
        onChange={setPeriod}
      />

      <div className="tiles">
        <Tile label={`Temps d'écoute ${periodLabel}`} value={formatListening(s.totalSeconds)} detail={`${s.activeDays} jour${s.activeDays > 1 ? 's' : ''} d'écoute`} />
        <Tile label="Épisodes terminés" value={s.completed.toLocaleString('fr-FR')} />
        <Tile label="Podcasts différents" value={s.podcasts.length.toLocaleString('fr-FR')} />
        <Tile label="Série en cours" value={`${all.currentStreak} jour${all.currentStreak > 1 ? 's' : ''}`} detail={`Record : ${all.bestStreak} jour${all.bestStreak > 1 ? 's' : ''}`} />
      </div>

      <BarChart
        title={period === 'month' ? 'Temps d’écoute par jour' : 'Temps d’écoute par mois'}
        bars={bars}
        format={axisMinutes}
        labelEvery={period === 'month' ? 5 : 1}
        unit={timeUnit(Math.max(...bars.map((b) => b.value)))}
      />

      <div className="stats-columns">
        <section>
          <h2 className="section-title">Podcasts les plus écoutés</h2>
          <RankedBars
            format={formatListening}
            items={s.podcasts.slice(0, 5).map((p) => ({
              key: p.item.id,
              value: p.seconds,
              label: (
                <Link to={podcastPath(p.item.id)} className="ranked__link">
                  <Artwork src={p.item.artwork} alt={p.item.title} size={32} />
                  {p.item.title}
                </Link>
              ),
            }))}
          />
        </section>
        <section>
          <h2 className="section-title">Catégories</h2>
          <RankedBars format={formatListening} items={s.genres.slice(0, 5).map((g) => ({ key: g.item, value: g.seconds, label: g.item }))} />
        </section>
      </div>

      <BarChart
        title="Heures d'écoute dans la journée (depuis le début)"
        bars={all.hours.map((value, h) => ({ label: `${h} h`, name: `${h} h – ${h + 1} h`, value }))}
        format={axisMinutes}
        labelEvery={6}
        height={120}
        unit={timeUnit(Math.max(...all.hours))}
      />

      {yearSummary.totalSeconds >= 60 && (
        <section className="recap">
          <h2 className="section-title">Votre année {year}</h2>
          <p>{yearRecap(year, yearSummary)}</p>
          <button className="btn btn--outline btn--small" onClick={() => shareText(`Mon année ${year} en podcasts`, yearRecap(year, yearSummary)).then(setNotice)}>
            <Share2 size={14} /> Partager
          </button>
          {notice && <p className="small muted">{notice}</p>}
        </section>
      )}
    </div>
  );
}
