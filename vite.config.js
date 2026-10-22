import { defineConfig } from 'vite';

// Relative base so the built files also work from a Capacitor WebView (file / app scheme).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Phaser alone is ~1.2 MB minified
  },
  server: {
    host: true,
  },
});
