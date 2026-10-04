// Signale au site qu'il tourne dans l'appli Podsal pour ordinateur, avec sa version
// (pour masquer « Télécharger l'appli » et proposer une nouvelle version si besoin).
const { contextBridge, ipcRenderer } = require('electron');

let version = null;
try {
  version = ipcRenderer.sendSync('podsal:version');
} catch {
  // version inconnue
}
contextBridge.exposeInMainWorld('podsalDesktop', { platform: process.platform, version, autoUpdate: process.platform !== 'darwin' });
