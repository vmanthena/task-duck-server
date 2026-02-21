import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server/src'),
      '@client': path.resolve(__dirname, 'client/src'),
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts', 'shared/**/*.ts', 'client/src/utils.ts', 'client/src/formData.ts'],
      exclude: ['server/src/index.ts', 'client/src/main.ts', '**/*.test.ts'],
    },
  },
});
