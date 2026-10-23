import { defineConfig } from '@playwright/test';

// UI tests always use their own local data, including when .env points to Supabase.
const testURL = 'http://127.0.0.1:5175';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  testIgnore: '**/pwa.production.spec.js',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: testURL,
    headless: true,
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1100 },
    launchOptions: { channel: 'msedge' },
  },
  reporter: 'list',
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175 --strictPort --configLoader native',
    url: testURL,
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
