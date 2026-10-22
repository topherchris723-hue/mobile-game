// Playwright UI checks (tests/e2e/*.spec.js). Runs against the production build via `vite preview`.
// Chromium comes from PLAYWRIGHT_BROWSERS_PATH (preinstalled); set PW_CHROMIUM to override the binary.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

const phone = (w, h, dpr) => ({
  ...devices['Pixel 7'],
  viewport: { width: w, height: h },
  screen: { width: w, height: h },
  deviceScaleFactor: dpr,
  isMobile: true,
  hasTouch: true,
  launchOptions,
});

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 180000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  projects: [
    { name: 'phone-360x640', use: phone(360, 640, 2) },
    { name: 'phone-430x932', use: phone(430, 932, 3) },
  ],
  webServer: {
    command: `node scripts/build.js && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false, // always rebuild; a reused server would serve a stale dist/
    timeout: 120000,
  },
});
