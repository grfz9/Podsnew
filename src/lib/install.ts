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

/** Appli Podsal pour ordinateur (Electron) : elle expose `window.podsalDesktop`. */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && 'podsalDesktop' in window;
}

export function isStandalone(): boolean {
  return (
    isDesktopApp() ||
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

export type DesktopOs = 'windows' | 'mac' | 'linux';

/** Système de l'ordinateur (null : téléphone, tablette ou Chromebook). */
export function desktopOs(ua = navigator.userAgent): DesktopOs | null {
  if (detectPlatform(ua) !== 'desktop' || /CrOS/.test(ua)) return null;
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/Linux|X11/.test(ua)) return 'linux';
  return null;
}

/** Fichiers de l'appli pour ordinateur, publiés par .github/workflows/desktop.yml dans la dernière release. */
const RELEASE = 'https://github.com/grfz9/Podsnew/releases/latest/download';
export const DESKTOP_DOWNLOADS: Record<DesktopOs, { label: string; files: { label: string; url: string; note: string }[] }> = {
  windows: { label: 'Windows', files: [{ label: 'Windows', url: `${RELEASE}/Podsal-Setup.exe`, note: 'Windows 10 et 11 · .exe' }] },
  mac: {
    label: 'Mac',
    files: [
      { label: 'Mac (puce Apple)', url: `${RELEASE}/Podsal-mac-arm64.dmg`, note: 'M1 à M4 et plus récents · .dmg' },
      { label: 'Mac (Intel)', url: `${RELEASE}/Podsal-mac-x64.dmg`, note: 'Mac d’avant fin 2020 · .dmg' },
    ],
  },
  linux: {
    label: 'Linux',
    files: [
      { label: 'Linux (.deb)', url: `${RELEASE}/Podsal-linux.deb`, note: 'Ubuntu, Debian, Mint' },
      { label: 'Linux (.AppImage)', url: `${RELEASE}/Podsal-linux.AppImage`, note: 'Autres distributions' },
    ],
  },
};

/** « 1.10.0 » est plus récent que « 1.9.2 ». */
export function isNewerVersion(a: string, b: string): boolean {
  const [x, y] = [a, b].map((v) => v.split('.').map((n) => parseInt(n, 10) || 0));
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

interface DesktopInfo {
  platform: string;
  /** Absente avant la 1.3.0 (la 1.0.0 ne se met pas à jour toute seule). */
  version?: string | null;
  autoUpdate?: boolean;
}

/** Appli pour ordinateur qui ne peut pas se mettre à jour seule (1.0.0, Mac) : version installée, sinon null. */
export function manualDesktopVersion(): string | null {
  const info = (window as Window & { podsalDesktop?: DesktopInfo }).podsalDesktop;
  if (!info) return null;
  if (info.version && info.autoUpdate) return null; // electron-updater s'en occupe
  return info.version ?? '1.0.0';
}

/** Dernière version publiée de l'appli pour ordinateur (release « desktop-vX.Y.Z »). */
export async function latestDesktopVersion(): Promise<string | null> {
  try {
    const res = await fetch('https://api.github.com/repos/grfz9/Podsnew/releases/latest');
    if (!res.ok) return null;
    const tag = String((await res.json()).tag_name ?? '');
    return tag.startsWith('desktop-v') ? tag.slice('desktop-v'.length) : null;
  } catch {
    return null;
  }
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
