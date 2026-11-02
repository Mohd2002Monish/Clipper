import { test, expect } from '@playwright/test';

/**
 * Manual Smoke Test: Real Meta Instagram Direct Login Flow (@manual-smoke)
 *
 * This test is designed for manual execution by a human tester using a real Meta / Instagram
 * test account. It is skipped by default during automated CI/CD runs.
 *
 * To execute:
 * RUN_MANUAL_SMOKE=1 npx playwright test e2e/instagram.smoke.spec.ts --project=chromium --headed
 *
 * Requirements:
 * - Does NOT automate password entry, MFA, or CAPTCHA bypass.
 * - Allows tester to interact with the real Meta authorization page.
 * - Verifies callback redirect, state validation, and account metadata retrieval.
 * - NEVER publishes any content automatically.
 *
 * Note: Strictly zero emojis used in code, descriptions, or logs.
 */

test.describe('Instagram Real OAuth Manual Smoke Test @manual-smoke', () => {
  // Skip test unless RUN_MANUAL_SMOKE=1 is explicitly provided
  test.skip(
    process.env.RUN_MANUAL_SMOKE !== '1',
    'Skipping manual smoke test. Set RUN_MANUAL_SMOKE=1 to run with real Meta credentials in headed browser.'
  );

  test('Interactive manual login and account connection verification', async ({ page }) => {
    // Generous timeout allowing manual login, 2FA, and consent authorization
    test.setTimeout(180000);

    // 1. Navigate to VideoTimmer Instagram Composer
    await page.goto('/?tab=instagram-composer');

    // 2. Open Account Management Modal
    const noAccountBtn = page.getByRole('button', { name: /No Account Connected/i });
    const existingPill = page.locator('button', { hasText: /^@[a-zA-Z0-9._]+/ });

    if (await noAccountBtn.isVisible()) {
      await noAccountBtn.click();
    } else if (await existingPill.isVisible()) {
      await existingPill.click();
      await page.getByRole('button', { name: 'Manage All' }).click();
      await page.getByRole('button', { name: '+ Connect via Meta OAuth' }).click();
    }

    // 3. Trigger Meta Direct Instagram OAuth
    const connectBtn = page.getByRole('button', { name: 'Connect Instagram Account' });
    await expect(connectBtn).toBeVisible();

    console.log(
      '[MANUAL SMOKE] Initiating Meta Instagram Direct Login. Please complete login in the opened browser window...'
    );

    await connectBtn.click();

    // 4. Wait for redirect back to VideoTimmer callback with timeout
    await page.waitForURL(/\/auth\/instagram\/callback|\/\?tab=instagram-composer/, {
      timeout: 120000,
    });

    // 5. Verify successful redirect back to the composer tab
    await expect(page).toHaveURL(/\/?tab=instagram-composer/);

    // 6. Verify success modal or notification
    const successNotice = page.getByRole('heading', { name: 'Instagram Account Connected!' });
    await expect(successNotice).toBeVisible({ timeout: 15000 });

    // Acknowledge notice
    await page.getByRole('button', { name: 'OK' }).click();

    // 7. Verify account metadata is rendered in header
    const connectedAccountBadge = page.getByText('Instagram Login');
    await expect(connectedAccountBadge).toBeVisible();

    console.log('[MANUAL SMOKE] Instagram account successfully connected and verified without publishing content.');
  });
});

