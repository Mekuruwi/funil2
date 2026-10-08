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
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 55,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
  },
});
