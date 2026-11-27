import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/widgets/**/*.ts', 'scripts/lesson-rules.mjs'],
      reporter: ['text-summary', 'text', 'json-summary'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 70 },
    },
  },
});
