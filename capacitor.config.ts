import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Application mobile native (Android et iOS) : elle embarque le build web (dist/).
 * Après chaque modification : `npm run build && npx cap sync`.
 */
const config: CapacitorConfig = {
  appId: 'app.podsnew',
  appName: 'Podsnew',
  webDir: 'dist',
  backgroundColor: '#121212',
  plugins: {
    LocalNotifications: {
      iconColor: '#1ed760',
    },
  },
};

export default config;
