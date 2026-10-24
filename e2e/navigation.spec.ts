import { test, expect } from '@playwright/test';

test.describe('VideoTimmer UI Navigation & Health Diagnostics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render the brand header and version badge', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('VideoTimmer');
    await expect(page.getByText('Core v1.0')).toBeVisible();
    await expect(page.getByText('Reframe, Split, Safe Typography & Google Drive Dispatcher')).toBeVisible();
  });

  test('should render and switch between all 4 primary navigation tabs', async ({ page }) => {
    // 1. Verify New Job is active by default
    const newJobBtn = page.getByRole('button', { name: 'New Job' });
    await expect(newJobBtn).toBeVisible();

    // 2. Click Job Queue tab
    const queueBtn = page.getByRole('button', { name: 'Job Queue' });
    await queueBtn.click();
    await expect(page.getByRole('heading', { name: /BullMQ Worker Queue|Active Render Job/i })).toBeVisible();

    // 3. Click History tab
    const historyBtn = page.getByRole('button', { name: 'History' });
    await historyBtn.click();
    await expect(page.getByRole('heading', { name: 'Render Job History' })).toBeVisible();

    // 4. Click Settings & Logs tab
    const settingsBtn = page.getByRole('button', { name: 'Settings & Logs' });
    await settingsBtn.click();
    await expect(page.getByRole('heading', { name: 'Settings & Section 8 Diagnostics' })).toBeVisible();

    // 5. Return to New Job
    await newJobBtn.click();
    await expect(page.getByText('Step 01')).toBeVisible();
  });

  test('should display the diagnostic strip with system service statuses', async ({ page }) => {
    await expect(page.getByText('FFmpeg / Probe')).toBeVisible();
    await expect(page.getByText('Database & Queue')).toBeVisible();
    await expect(page.getByText('Working Storage')).toBeVisible();
    await expect(page.getByText('Google Drive', { exact: true })).toBeVisible();
  });
});
