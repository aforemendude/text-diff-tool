import { defineConfig, devices } from '@playwright/test';
import { cpus } from 'node:os';

const previewBaseURL = 'http://localhost:4173';
const configuredBaseURL = process.env['BASE_URL'];
const baseURL = configuredBaseURL || previewBaseURL;
const cpuCoreCount = cpus().length;

export default defineConfig({
  testDir: './playwright',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: cpuCoreCount,
  reporter: 'html',
  use: {
    baseURL,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      // WebKit's processes can become unresponsive when using every available CPU core in constrained environments.
      workers: Math.max(1, Math.floor(cpuCoreCount / 2)),
      use: {
        ...devices['Desktop Safari'],
        launchOptions: {
          // Snap applications can inject GIO modules linked against an incompatible glibc, which crashes WebKit's
          // network process.
          env: { ...process.env, GIO_MODULE_DIR: undefined },
        },
      },
    },
  ],

  // A configured URL is owned by the caller and must already be running. Otherwise Playwright starts the production
  // preview server for the duration of the test run.
  webServer: configuredBaseURL
    ? undefined
    : {
        command: 'npm run preview',
        url: previewBaseURL,
        reuseExistingServer: false,
      },
});
