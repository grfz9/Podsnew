import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, ChartColumn, Check, Download, Image, ScrollText } from 'lucide-react';
import { openBillingPortal, PLANS, startCheckout, type Plan } from '../api/billing';
import { AppMark } from '../components/Wordmark';
import { useAuth } from '../store/auth';
import { FREE_DOWNLOADS, usePremium } from '../store/premium';

const BENEFITS = [
  { icon: Image, title: 'Tous les fonds d’écran', text: 'Étoiles dorées, arcades, coupole au crépuscule, aube, zellige…' },
  { icon: Download, title: 'Téléchargements illimités', text: `Sans abonnement : ${FREE_DOWNLOADS} épisodes ou sourates hors-ligne.` },
  { icon: ChartColumn, title: 'Statistiques avancées', text: 'Historique complet, catégories, heures d’écoute, bilan de l’année et export.' },
  { icon: ScrollText, title: '20 résumés par jour', text: 'Pour les podcasts généraux (jamais sur le religieux). Sans abonnement : 3 par jour.' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function PremiumPage() {
  const auth = useAuth();
  const premium = usePremium();
  const [params, setParams] = useSearchParams();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(params.get('paiement') === 'ok');

  // Retour de Stripe : l'abonnement est enregistré par le webhook, on le relit quelques secondes.
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    let stopped = false;
    const tick = async () => {
      const active = await premium.refresh();
      tries++;
      if (stopped) return;
      if (active || tries >= 15) {
        setWaiting(false);
        setParams({}, { replace: true });
      } else setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const sub = premium.subscription;

  return (
    <div className="page premium-page">
      <header className="premium-hero">
        <span className="brand__mark premium-hero__mark">
          <AppMark title="" />
        </span>
        <h1 className="page__title">Podsal+</h1>
        <p className="muted">Soutenez Podsal et profitez de plus de confort.</p>
      </header>

      <ul className="premium-benefits">
        {BENEFITS.map(({ icon: Icon, title, text }, i) => (
          <li key={title} style={{ '--i': i } as CSSProperties}>
            <span className="premium-benefits__icon">
              <Icon size={20} />
            </span>
            <span>
              <strong>{title}</strong>
              <span className="small muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="small premium-free">
        <BookOpen size={15} /> Le Coran, les horaires de prière et les podcasts islamiques restent gratuits pour tous.
      </p>

      {params.get('paiement') === 'annule' && <p className="small muted">Paiement annulé : rien n'a été prélevé.</p>}
      {waiting && <p className="small">Paiement reçu, activation de Podsal+…</p>}

      {premium.isPremium && sub ? (
        <section className="premium-status">
          <p>
            <Check size={16} /> <strong>Podsal+ est actif</strong>
            {sub.plan && ` · formule ${PLANS[sub.plan].label.toLowerCase()}`}
          </p>
          {sub.current_period_end && (
            <p className="small muted">
              {sub.cancel_at_period_end ? 'Se termine le ' : 'Renouvellement le '}
              {formatDate(sub.current_period_end)}
              {sub.status === 'past_due' && ' · paiement en attente : vérifiez votre moyen de paiement'}
            </p>
          )}
          {premium.canPurchase && (
            <button className="btn btn--outline" disabled={busy} onClick={() => run(openBillingPortal)}>
              Gérer mon abonnement
            </button>
          )}
        </section>
      ) : !auth.enabled ? (
        <p className="muted">L'abonnement nécessite l'activation des comptes sur cette installation.</p>
      ) : !premium.canPurchase ? (
        <p className="muted">L'abonnement n'est pas encore proposé dans l'application pour téléphone.</p>
      ) : (
        <>
          <div className="plan-grid" role="radiogroup" aria-label="Formule">
            {(Object.keys(PLANS) as Plan[]).map((id) => (
              <button key={id} role="radio" aria-checked={plan === id} className={`plan-card ${plan === id ? 'plan-card--selected' : ''}`} onClick={() => setPlan(id)}>
                {id === 'yearly' && <span className="plan-card__tag">Le plus avantageux</span>}
                <span className="plan-card__label">{PLANS[id].label}</span>
                <span className="plan-card__price">{PLANS[id].price}</span>
                <span className="small muted">{PLANS[id].detail}</span>
              </button>
            ))}
          </div>
          {auth.userId ? (
            <button className="btn btn--primary premium-cta" disabled={busy} onClick={() => run(() => startCheckout(plan))}>
              {busy ? 'Ouverture du paiement…' : `S'abonner · ${PLANS[plan].price}`}
            </button>
          ) : (
            <Link to="/account" className="btn btn--primary premium-cta">
              Créer un compte pour s'abonner
            </Link>
          )}
          <p className="small muted">Paiement sécurisé par Stripe. Sans engagement : résiliable à tout moment depuis « Gérer mon abonnement ».</p>
        </>
      )}
      {error && <p className="small error-text">{error}</p>}
    </div>
  );
}
