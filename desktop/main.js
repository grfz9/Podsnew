/**
 * Podsal pour ordinateur (Windows, macOS, Linux) : une fenêtre qui ouvre podsal.com.
 * Le contenu vient du site, donc l'appli se met à jour toute seule, comme la version web ;
 * le service worker du site la garde utilisable hors-ligne après la première ouverture.
 */
const { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, net, powerMonitor, screen, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
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
// Profil séparé pour les essais de développement (ne touche pas à l'appli installée).
if (process.env.PODSAL_PROFILE) app.setPath('userData', process.env.PODSAL_PROFILE);

/**
 * Écrit sur le disque ce que le site garde en mémoire (session de connexion, réglages).
 * Sans cela, une fermeture brutale (arrêt du PC, fin de tâche) peut perdre la session renouvelée
 * par Supabase au lancement, et l'appli se retrouve déconnectée au démarrage suivant.
 */
const flushStorage = () => {
  try {
    session.defaultSession.flushStorageData();
  } catch {
    // session pas encore prête
  }
};
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

/**
 * Mises à jour de l'appli elle-même (rare : le contenu vient déjà du site).
 * Windows et Linux : téléchargement en arrière-plan depuis la dernière release GitHub, installation au
 * redémarrage. Mac : l'installation automatique exige une signature Apple ; on propose de retélécharger.
 */
const SIX_HOURS = 6 * 60 * 60 * 1000;
const isNewer = (a, b) => {
  const [x, y] = [a, b].map((v) => String(v).split('.').map((n) => parseInt(n, 10) || 0));
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
let updateAnnounced = false;
const testMode = !!process.env.PODSAL_PROFILE;

// Journal des mises à jour (userData/mises-a-jour.log), pour comprendre un échec.
function logUpdate(...parts) {
  try {
    const file = path.join(app.getPath('userData'), 'mises-a-jour.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 200_000) fs.renameSync(file, `${file}.ancien`);
    fs.appendFileSync(file, `${new Date().toISOString()} [${app.getVersion()}] ${parts.map(String).join(' ')}
`);
  } catch {
    // journal facultatif
  }
}

async function announceUpdate(version, ready) {
  if (updateAnnounced) return;
  updateAnnounced = true;
  logUpdate(ready ? 'prête :' : 'disponible :', version);
  if (testMode) return; // essais de développement : pas de fenêtre
  const { response } = await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
    type: 'info',
    title: 'Mise à jour de Podsal',
    message: `La version ${version} de Podsal est ${ready ? 'prête' : 'disponible'}.`,
    detail: ready ? 'Redémarrez pour l’installer maintenant, sinon elle s’installera quand vous fermerez Podsal.' : 'Téléchargez-la depuis podsal.com/telecharger pour la mettre à jour.',
    buttons: [ready ? 'Redémarrer' : 'Télécharger', 'Plus tard'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return;
  if (ready) {
    quitting = true;
    autoUpdater.quitAndInstall();
  } else {
    void shell.openExternal('https://podsal.com/telecharger');
  }
}

async function checkForUpdates() {
  if (updateAnnounced) return;
  try {
    if (isMac) {
      const res = await net.fetch('https://api.github.com/repos/grfz9/Podsnew/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
      const latest = String((await res.json()).tag_name || '').replace(/^desktop-v/, '');
      if (isNewer(latest, app.getVersion())) void announceUpdate(latest, false);
    } else {
      await autoUpdater.checkForUpdates();
    }
  } catch (e) {
    logUpdate('vérification impossible :', e?.message ?? e); // hors-ligne… : on réessaiera plus tard
  }
}

function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.on('error', (e) => logUpdate('erreur :', e?.message ?? e));
  autoUpdater.on('checking-for-update', () => logUpdate('vérification…'));
  autoUpdater.on('update-not-available', (info) => logUpdate('à jour, dernière version :', info?.version));
  autoUpdater.on('update-available', (info) => logUpdate('téléchargement de', info?.version));
  autoUpdater.on('update-downloaded', (info) => void announceUpdate(info.version, true));
  setTimeout(checkForUpdates, 15_000);
  setInterval(checkForUpdates, SIX_HOURS);
}

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
    flushStorage();
    // Sur Mac, fermer la fenêtre la cache (l'écoute continue), comme Musique ou Spotify.
    if (isMac && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('blur', flushStorage);
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
    flushStorage();
  });
  app.on('activate', showWindow);
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });

  ipcMain.on('podsal:version', (e) => {
    e.returnValue = app.getVersion();
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(isPodsal(wc.getURL()) && ALLOWED.has(permission)));
    session.defaultSession.setPermissionCheckHandler((wc, permission) => !!wc && isPodsal(wc.getURL()) && ALLOWED.has(permission));
    // Sur Mac, le menu du haut porte les raccourcis copier/coller ; ailleurs, pas de barre de menus.
    Menu.setApplicationMenu(isMac ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]) : null);
    createWindow();
    setupUpdates();
    setInterval(flushStorage, 30_000);
    for (const event of ['suspend', 'shutdown', 'lock-screen']) powerMonitor.on(event, flushStorage);
  });
}
