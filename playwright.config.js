'use strict';

/**
 * Configuración compartida de Playwright para rendimiento y UI/UX.
 * El origen por defecto sale de config/origenes-tintin.json para que el
 * futuro cutover no deje pruebas apuntando al dominio anterior.
 */
const { defineConfig, devices } = require('@playwright/test');
const { publicOrigin } = require('./config/origenes-tintin.json');

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
      publicOrigin,
    launchOptions: executablePath
      ? { executablePath, args: ['--no-sandbox'] }
      : { args: ['--no-sandbox'] }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
