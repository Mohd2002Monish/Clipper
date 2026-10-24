import { test, expect } from '@playwright/test';

test.describe('VideoTimmer History & Settings / Section 8 Logs', () => {
  test('Settings: Google Drive configuration and Section 8 Log Viewer', async ({ page }) => {
    await page.goto('/');

    // Navigate to Settings
    await page.getByRole('button', { name: 'Settings & Logs' }).click();

    await expect(page.getByRole('heading', { name: 'Settings & Section 8 Diagnostics' })).toBeVisible();

    // Verify Google Drive Card
    await expect(page.getByText('Google Drive Storage (v3)')).toBeVisible();
    await expect(page.getByText('Target Folder ID or Shared URL')).toBeVisible();
    await expect(page.getByRole('button', { name: /Test Connection & Write Access/i })).toBeVisible();

    // Verify Engine Limits & Defaults
    await expect(page.getByText('Engine Limits & Defaults')).toBeVisible();
    await expect(page.getByText('Default Preset')).toBeVisible();
    await expect(page.getByText('Max Upload (MB)')).toBeVisible();
    await expect(page.getByText('Concurrency')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save System Settings' })).toBeVisible();

    // Verify Section 8 JSON Lines Log Viewer
    await expect(page.getByText('Section 8 JSON Lines Log Viewer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ALL' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'INFO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WARN' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ERROR' })).toBeVisible();
  });

  test('History: Catalog search and status filters', async ({ page }) => {
    await page.goto('/');

    // Navigate to History
    await page.getByRole('button', { name: 'History' }).click();

    await expect(page.getByRole('heading', { name: 'Render Job History' })).toBeVisible();
    await expect(page.getByPlaceholder('Search filename...')).toBeVisible();

    // Status filter buttons
    await expect(page.getByRole('button', { name: 'all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'completed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'processing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'failed' })).toBeVisible();

    // Table headers
    await expect(page.getByRole('columnheader', { name: 'Source Video' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Date' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Format / Ratio' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Parts' })).toBeVisible();
  });
});
