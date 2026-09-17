import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for SpaceLens
 * Supports both local testing and remote Staging CI/CD environments.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  /* Chạy tuần tự trên CI để kiểm soát tài nguyên và log */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  
  /* Báo cáo dạng HTML và List terminal */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    /* Đọc địa chỉ Staging từ biến môi trường STAGING_URL, mặc định localhost:5173 */
    baseURL: process.env.STAGING_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
