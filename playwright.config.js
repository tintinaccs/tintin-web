'use strict';

/**
 * Configuración compartida de Playwright para rendimiento y UI/UX.
 *
 * Rendimiento:
 *   PERF_BASE_URL="https://tintinaccesorios.pages.dev" npx playwright test tests/performance
 *
 * UI/UX local:
 *   PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173" npx playwright test tests/ui-ux
 */
const { defineConfig, devices } = require('@playwright/test');

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      process.env.PERF_BASE_URL ||
      'https://tintinaccesorios.pages.dev',
    launchOptions: executablePath
      ? { executablePath, args: ['--no-sandbox'] }
      : { args: ['--no-sandbox'] }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
