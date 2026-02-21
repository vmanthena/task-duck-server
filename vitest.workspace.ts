import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'server',
      environment: 'node',
      include: [
        'tests/unit/server/**/*.test.ts',
        'tests/unit/shared/**/*.test.ts',
        'tests/integration/**/*.test.ts',
        'tests/e2e/**/*.test.ts',
      ],
      setupFiles: ['tests/setup/server.setup.ts'],
      globals: true,
    },
  },
  {
    test: {
      name: 'client',
      environment: 'happy-dom',
      include: ['tests/unit/client/**/*.test.ts'],
      setupFiles: ['tests/setup/client.setup.ts'],
      globals: true,
    },
  },
]);
