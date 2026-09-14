import { test, expect } from '@playwright/test';

test.describe('SpaceLens Staging Environment: E2E Smoke & Health Check', () => {

  test.beforeEach(async ({ page }) => {
    // Điều hướng tới môi trường Staging (hoặc URL được chỉ định trong STAGING_URL)
    await page.goto('/');
  });

  test('TC01: Verify web application loads successfully and displays branding', async ({ page }) => {
    // 1. Kiểm tra tiêu đề trang chứa SpaceLens
    await expect(page).toHaveTitle(/SpaceLens/i);

    // 2. Kiểm tra thanh Navigation Header xuất hiện trên màn hình
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('TC02: Verify tab navigation workflow', async ({ page }) => {
    // 1. Tab mặc định: Camera Devices Management
    await expect(page.getByText('Camera Devices Management', { exact: false })).toBeVisible();

    // 2. Chuyển sang Tab "ZONES"
    await page.click('button:has-text("ZONES")');
    await expect(page.getByText('ZONE & AI RULE CONFIGURATION')).toBeVisible();

    // 3. Chuyển sang Tab "USERS"
    await page.click('button:has-text("USERS")');
    await expect(page.getByText('USERS & ACCESS PERMISSIONS')).toBeVisible();

    // 4. Chuyển sang Tab "AUDITS"
    await page.click('button:has-text("AUDITS")');
    await expect(page.getByText('CONNECTION & AUDIT LOGS')).toBeVisible();

    // 5. Chuyển sang Tab "SETTINGS"
    await page.click('button:has-text("SETTINGS")');
    await expect(page.getByText('SYSTEM SETTINGS')).toBeVisible();
  });

  test('TC03: Verify Camera Management Studio core layout', async ({ page }) => {
    // Đảm bảo ở tab DEVICES
    await page.click('button:has-text("DEVICES")');

    // Kiểm tra ô tìm kiếm Camera và danh sách điều khiển
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Cam-01');
      await expect(searchInput).toHaveValue('Cam-01');
    }
  });
});
