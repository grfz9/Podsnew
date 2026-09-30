import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Sparkle } from 'lucide-react';

/** Encart qui remplace une fonctionnalité réservée à Podsal+. */
export function PremiumTeaser({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="premium-teaser">
      <Sparkle size={20} className="premium-teaser__icon" aria-hidden />
      <div>
        <h2>{title}</h2>
        {children && <p className="small muted">{children}</p>}
      </div>
      <Link to="/premium" className="btn btn--primary btn--small">
        Découvrir Podsal+
      </Link>
    </section>
  );
}
