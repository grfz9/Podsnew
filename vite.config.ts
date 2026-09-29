import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : l'app fonctionne aussi depuis un sous-dossier (GitHub Pages, etc.)
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
