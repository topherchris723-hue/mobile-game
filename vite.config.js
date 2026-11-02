import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { thirdPartyLicenses, readGameTitle } from './scripts/third-party-licenses.mjs';

// Relative base so the built files also work from a Capacitor WebView (file / app scheme).
export default defineConfig({
  base: './',
  // dist/THIRD_PARTY_LICENSES.txt from the bundle's module list (compliance round 6; shown in Settings → Licenses)
  // Product name = src/ui/strings.json game_title (GDD §1, AC-1.1), so the notice cannot drift from the title screen.
  plugins: [thirdPartyLicenses(readGameTitle(fileURLToPath(new URL('./src/ui/strings.json', import.meta.url))))],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB minified
  },
  server: {
    host: true,
  },
});
