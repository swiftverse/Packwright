'use strict';

const { defineConfig, devices } = require('@playwright/test');

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
];

if (process.env.PW_FIREFOX === '1') {
  projects.push({ name: 'firefox', use: { ...devices['Desktop Firefox'] } });
}
if (process.env.PW_WEBKIT === '1') {
  projects.push({ name: 'webkit', use: { ...devices['Desktop Safari'] } });
}

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:47321',
    acceptDownloads: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  },
  webServer: {
    command: 'node scripts/serve.js',
    url: 'http://127.0.0.1:47321/',
    reuseExistingServer: false,
    timeout: 20000
  },
  projects: projects
});
