import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { getSubscription, isActive, type SubscriptionRow } from '../api/billing';
import { useAuth } from './auth';

/** Téléchargements hors-ligne sans abonnement. */
export const FREE_DOWNLOADS = 10;

interface PremiumValue {
  isPremium: boolean;
  subscription: SubscriptionRow | null;
  loading: boolean;
  /** Le paiement se fait sur le web : Apple et Google imposent leurs propres achats dans les applications natives. */
  canPurchase: boolean;
  refresh: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumValue | null>(null);

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSubscription(null);
      return false;
    }
    setLoading(true);
    try {
      const sub = await getSubscription(userId);
      setSubscription(sub);
      return isActive(sub);
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Un abonnement peut changer ailleurs (résiliation, renouvellement) : on relit au retour dans l'appli.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo<PremiumValue>(
    () => ({ isPremium: isActive(subscription), subscription, loading, canPurchase: !Capacitor.isNativePlatform(), refresh }),
    [subscription, loading, refresh],
  );
  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium doit être utilisé dans <PremiumProvider>');
  return ctx;
}
