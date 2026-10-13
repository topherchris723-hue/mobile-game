import { defineConfig } from 'vitest/config';

/** `npm run balance`: AI-vs-AI simulations that print win rates (not part of `npm test`). */
export default defineConfig({
  test: {
    include: ['tests/balance/**/*.sim.ts'],
    environment: 'node',
    testTimeout: 600_000,
  },
});
