import { useId, useState, type ReactNode } from 'react';

export interface Bar {
  /** Étiquette courte sous l'axe (ex. « janv. »). */
  label: string;
  value: number;
  /** Libellé complet pour l'info-bulle et le tableau (ex. « janvier 2026 »). */
  name: string;
}

const NICE = [2, 4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80];

/** Plus petit maximum d'axe « rond » dont la moitié (graduation du milieu) est ronde aussi. */
export function niceMax(max: number): number {
  if (max <= 0) return 2;
  let pow = 1;
  while (max > 80 * pow) pow *= 10;
  return NICE.find((n) => n * pow >= max)! * pow;
}

/**
 * Histogramme à une série : barres fines ancrées sur la ligne de base, info-bulle
 * au survol et au clavier, et tableau équivalent pour les lecteurs d'écran.
 */
export function BarChart({
  title,
  bars,
  format,
  labelEvery = 1,
  height = 160,
  unit = 1,
}: {
  title: string;
  bars: Bar[];
  format: (v: number) => string;
  labelEvery?: number;
  height?: number;
  /** Unité d'affichage de l'axe (ex. 3600 pour des graduations en heures rondes). */
  unit?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  const max = niceMax(Math.max(...bars.map((b) => b.value), 0) / unit) * unit;
  const ticks = [0, max / 2, max];

  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption className="chart__head">
        <span id={`${id}-title`} className="chart__title">
          {title}
        </span>
        <button className="btn btn--ghost btn--small" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
          {showTable ? 'Masquer le tableau' : 'Voir le tableau'}
        </button>
      </figcaption>

      <div className="chart__plot" style={{ height }} onMouseLeave={() => setActive(null)}>
        <div className="chart__grid" aria-hidden>
          {ticks
            .slice()
            .reverse()
            .map((t) => (
              <div key={t} className="chart__gridline">
                <span>{format(t)}</span>
              </div>
            ))}
        </div>
        <div className="chart__bars" role="list">
          {bars.map((b, i) => (
            <div
              key={i}
              role="listitem"
              tabIndex={0}
              className={`chart__slot ${active === i ? 'chart__slot--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${b.name} : ${format(b.value)}`}
            >
              <div className="chart__bar" style={{ height: `${(b.value / max) * 100}%` }} />
              {active === i && (
                <div className={`chart__tooltip ${i > bars.length / 2 ? 'chart__tooltip--left' : ''}`} role="tooltip">
                  <strong>{format(b.value)}</strong>
                  <span>{b.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="chart__labels" aria-hidden>
        {bars.map((b, i) => (
          <span key={i}>{i % labelEvery === 0 ? b.label : ''}</span>
        ))}
      </div>

      {showTable && (
        <table className="chart__table">
          <tbody>
            {bars.map((b, i) => (
              <tr key={i}>
                <th scope="row">{b.name}</th>
                <td>{format(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

/** Classement avec barres horizontales (valeur en texte, jamais dans la couleur de la barre). */
export function RankedBars({ items, format }: { items: { key: string; label: ReactNode; value: number }[]; format: (v: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ol className="ranked">
      {items.map((item, index) => (
        <li key={item.key} className="ranked__row">
          <span className="ranked__rank">{index + 1}</span>
          <div className="ranked__main">
            <div className="ranked__label">{item.label}</div>
            <div className="ranked__track">
              <div className="ranked__bar" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
          <span className="ranked__value">{format(item.value)}</span>
        </li>
      ))}
    </ol>
  );
}
