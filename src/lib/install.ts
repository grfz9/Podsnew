import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Installation de Podsal comme une appli (PWA) : Chrome, Edge et Android proposent l'installation
 * via l'événement « beforeinstallprompt », qu'il faut capter dès le chargement ; sur iPhone,
 * il faut passer par « Partager → Sur l'écran d'accueil ».
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    Capacitor.isNativePlatform()
  );
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export type Platform = 'ios' | 'android' | 'desktop';

/** Appareil de la personne, pour lui montrer les bonnes étapes d'installation. */
export function detectPlatform(ua = navigator.userAgent): Platform {
  if (/iPad|iPhone|iPod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Navigateur intégré d'une appli (Instagram, Facebook, TikTok, Snapchat…) : l'installation y est impossible. */
export function isInAppBrowser(ua = navigator.userAgent): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Line\/|GSA\//i.test(ua);
}

/** Sur iPhone, seuls Safari (et depuis iOS 16.4 Chrome, Edge, Firefox) savent ajouter un site à l'écran d'accueil. */
export function iosBrowser(ua = navigator.userAgent): 'safari' | 'other' {
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) || isInAppBrowser(ua) ? 'other' : 'safari';
}

/** Lien à partager pour installer Podsal. */
export const INSTALL_URL = 'https://podsal.com/telecharger';

export type InstallMode = 'prompt' | 'ios' | null;

/** `prompt` : bouton d'installation ; `ios` : explication pour l'iPhone ; null : déjà installée ou impossible. */
export function useInstall(): { mode: InstallMode; install: () => Promise<boolean> } {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const mode: InstallMode = isStandalone() ? null : deferred ? 'prompt' : isIos() ? 'ios' : null;
  return {
    mode,
    install: async () => {
      if (!deferred) return false;
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}
