'use strict';

const { defineConfig } = require('@playwright/test');
const base = require('./playwright.config.js');

module.exports = defineConfig({
  ...base,
  testDir: './tests/operations',
  testMatch: 'central-loader-ui.spec.js',
  use: {
    ...base.use,
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'node scripts/servidor-local-pruebas.mjs 4173',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
