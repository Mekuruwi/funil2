import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/excelService.ts',
        'src/store/funilStore.ts',
        'src/utils/formatters.ts',
        'electron/database/configStore.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
        'electron/database/**': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
          perFile: true,
        },
        'src/store/**': {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
          perFile: true,
        },
      },
    },
  },
});
