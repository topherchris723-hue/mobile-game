import { defineConfig } from 'vite';
import { thirdPartyLicenses } from './scripts/third-party-licenses.mjs';

// Relative base so the built files also work from a Capacitor WebView (file / app scheme).
export default defineConfig({
  base: './',
  // dist/THIRD_PARTY_LICENSES.txt from the bundle's module list (compliance round 6; shown in Settings → Licenses)
  plugins: [thirdPartyLicenses('Jade Tempest')],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB minified
  },
  server: {
    host: true,
  },
});
