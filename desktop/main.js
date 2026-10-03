/**
 * Podsal pour ordinateur (Windows, macOS, Linux) : une fenêtre qui ouvre podsal.com.
 * Le contenu vient du site, donc l'appli se met à jour toute seule, comme la version web ;
 * le service worker du site la garde utilisable hors-ligne après la première ouverture.
 */
const { app, BrowserWindow, Menu, nativeTheme, screen, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const HOME = 'https://podsal.com/';
const isMac = process.platform === 'darwin';

// Pages qui s'ouvrent dans la fenêtre : Podsal, la connexion (Supabase, Google, Apple) et le paiement (Stripe).
// Tout autre lien s'ouvre dans le navigateur habituel.
const INSIDE = [/^podsal\.com$/, /\.supabase\.co$/, /^accounts\.google\.[a-z.]+$/, /^accounts\.youtube\.com$/, /^(appleid|idmsa)\.apple\.com$/, /(^|\.)stripe\.com$/];
const opensInside = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && INSIDE.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
};
const isPodsal = (url) => {
  try {
    return new URL(url).hostname === 'podsal.com';
  } catch {
    return false;
  }
};

// Autorisations accordées au site Podsal uniquement (notifications de l'adhan, plein écran vidéo, micro du studio…).
const ALLOWED = new Set(['notifications', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read', 'geolocation', 'media', 'mediaKeySystem', 'speaker-selection', 'fileSystem']);

// Agent utilisateur d'un Chrome classique : sans cela, Google refuse la connexion dans une appli.
app.userAgentFallback = app.userAgentFallback.replace(/ Electron\/\S+/, '').replace(/ Podsal\/\S+/i, '').replace(/ podsal-desktop\/\S+/i, '');
app.setAppUserModelId('app.podsal'); // notifications Windows au nom de Podsal
nativeTheme.themeSource = 'dark'; // barre de titre sombre

// Taille et position de la fenêtre, retrouvées au lancement suivant.
const stateFile = () => path.join(app.getPath('userData'), 'fenetre.json');
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const visible = screen.getAllDisplays().some(({ workArea: a }) => s.x < a.x + a.width - 80 && s.x + s.width > a.x + 80 && s.y >= a.y - 20 && s.y < a.y + a.height - 80);
    return visible ? s : { width: s.width, height: s.height, maximized: s.maximized };
  } catch {
    return {};
  }
}
function saveState(win) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    // tant pis : la fenêtre reprendra sa taille par défaut
  }
}

let win = null;
let quitting = false;

function createWindow() {
  const s = readState();
  win = new BrowserWindow({
    width: s.width || 1280,
    height: s.height || 820,
    x: s.x,
    y: s.y,
    minWidth: 380,
    minHeight: 560,
    title: 'Podsal',
    backgroundColor: '#0d1111',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // L'écoute, les horaires de prière et l'adhan continuent quand la fenêtre est réduite.
      backgroundThrottling: false,
      spellcheck: false,
    },
  });
  if (s.maximized) win.maximize();
  win.loadURL(HOME);

  const contents = win.webContents;
  // Liens « nouvel onglet » : navigateur habituel.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^(https?|mailto):/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (opensInside(url) || url.startsWith('file:')) return;
    e.preventDefault();
    if (/^(https?|mailto):/.test(url)) void shell.openExternal(url);
  });
  // Pas de connexion et rien en cache : petite page « hors-ligne » qui réessaie toute seule.
  contents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isPodsal(url)) void win.loadFile(path.join(__dirname, 'offline.html'));
  });
  // Raccourcis habituels : F5 / Ctrl+R recharger, F11 plein écran, Ctrl +/-/0 zoom.
  contents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const mod = isMac ? input.meta : input.control;
    const key = input.key.toLowerCase();
    if (input.key === 'F5' || (mod && key === 'r')) contents.reload();
    else if (input.key === 'F11' && !isMac) win.setFullScreen(!win.isFullScreen());
    else if (mod && (key === '+' || key === '=')) contents.setZoomLevel(Math.min(contents.getZoomLevel() + 0.5, 4));
    else if (mod && key === '-') contents.setZoomLevel(Math.max(contents.getZoomLevel() - 0.5, -3));
    else if (mod && key === '0') contents.setZoomLevel(0);
    else return;
    e.preventDefault();
  });

  win.on('close', (e) => {
    saveState(win);
    // Sur Mac, fermer la fenêtre la cache (l'écoute continue), comme Musique ou Spotify.
    if (isMac && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(isPodsal(wc.getURL()) && ALLOWED.has(permission)));
    session.defaultSession.setPermissionCheckHandler((wc, permission) => !!wc && isPodsal(wc.getURL()) && ALLOWED.has(permission));
    // Sur Mac, le menu du haut porte les raccourcis copier/coller ; ailleurs, pas de barre de menus.
    Menu.setApplicationMenu(isMac ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]) : null);
    createWindow();
  });
}
