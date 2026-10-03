// Signale au site qu'il tourne dans l'appli Podsal pour ordinateur (pour masquer « Télécharger l'appli »).
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('podsalDesktop', { platform: process.platform });
