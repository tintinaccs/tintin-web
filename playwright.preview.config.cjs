const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/development',
  timeout: 20000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4192',
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox'] },
  },
  webServer: {
    command: 'node scripts/vista-previa.mjs',
    env: {PORT:'4192'},
    url: 'http://127.0.0.1:4192',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
