import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use a separate test directory for unit tests
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Explicitly exclude Playwright tests
    exclude: ['playwright/**/*', 'node_modules/**/*'],
    environment: 'node',
  },
});
