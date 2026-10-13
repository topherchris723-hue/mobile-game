import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

/** Short commit SHA shown in the debug overlay so every bug report maps to an exact build. */
function resolveBuildId(): string {
  const fromCi = process.env['GITHUB_SHA'];
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

export default defineConfig({
  // Relative base so the same build works at the site root and under /preview/<branch>/.
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(resolveBuildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
