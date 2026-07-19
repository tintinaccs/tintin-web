'use strict';

/**
 * Configuración de Playwright para las pruebas de rendimiento (tests/performance).
 *
 * Estas pruebas NO forman parte del CI de auditoría (que es estático y sin
 * dependencias). Se corren a demanda donde haya navegador + red:
 *
 *   PERF_BASE_URL="https://tintinaccs.github.io/tintin-web" npx playwright test tests/performance
 *
 * En entornos con Chromium preinstalado fuera de node_modules, exportá
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH o usá el que Playwright descargue.
 */
const { defineConfig, devices } = require('@playwright/test');

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

module.exports = defineConfig({
  testDir: './tests/performance',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.PERF_BASE_URL || 'https://tintinaccs.github.io/tintin-web',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
