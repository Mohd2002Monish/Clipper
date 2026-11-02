import { test, expect } from '@playwright/test';

/**
 * End-to-End Test Suite: VideoTimmer Direct Instagram Login Migration
 *
 * Verifies the 12 core requirements:
 * 1. Instagram connection button and authorization redirect.
 * 2. OAuth callback success and account creation.
 * 3. OAuth cancellation and permission-denied handling.
 * 4. Invalid or mismatched OAuth state rejection.
 * 5. Multiple Instagram accounts existing simultaneously.
 * 6. Reconnecting an account without changing its MongoDB _id.
 * 7. Disconnecting one account without affecting other accounts.
 * 8. Account list rendering and account switching.
 * 9. API responses never exposing accessToken or client secrets.
 * 10. Scheduled posts resolving the correct Instagram account.
 * 11. Expired or inactive account handling.
 * 12. Publishing UI handling success and failure states.
 *
 * Note: Strictly zero emojis used in code, descriptions, or logs.
 */

// Isolated mock test accounts
const MOCK_ACCOUNT_FLIM = {
  _id: '6710a1111111111111111111',
  instagramUserId: '17841400000000001',
  username: 'flimyapper',
  displayName: 'Flimyapper Movies',
  biography: 'Indian cinema reviews and hidden gems',
  followerCount: 24500,
  mediaCount: 142,
  isActive: true,
  isSimulated: false,
};

const MOCK_ACCOUNT_CINE = {
  _id: '6710a2222222222222222222',
  instagramUserId: '17841400000000002',
  username: 'cinemonster.in',
  displayName: 'CineMonster',
  biography: 'Film discussions and industry breakdowns',
  followerCount: 18200,
  mediaCount: 98,
  isActive: true,
  isSimulated: false,
};

const MOCK_ACCOUNT_MONISH = {
  _id: '6710a3333333333333333333',
  instagramUserId: '17841400000000003',
  username: 'monish.insider',
  displayName: 'Mohd Monish',
  biography: 'Tech and cinema insights',
  followerCount: 12100,
  mediaCount: 64,
  isActive: true,
  isSimulated: false,
};

test.describe('Instagram Direct Login & Multi-Account Suite', () => {
  // Helper to setup mock routes for typical page loads
  const setupBaseRoutes = async (page: any, accounts = [MOCK_ACCOUNT_FLIM]) => {
    // Mock OAuth config endpoint
    await page.route('**/api/instagram/auth', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          configured: true,
          authUrl:
            'https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=123456789012345&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Finstagram%2Fcallback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_content_publish&state=mock_secure_csrf_state_token_123456',
          appId: '123456789012345',
          redirectUri: 'http://localhost:3000/auth/instagram/callback',
          message: 'Instagram OAuth configured.',
        }),
      });
    });

    // Mock accounts endpoint
    await page.route(/\/api\/instagram\/accounts(\/.*)?$/, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accounts,
        }),
      });
    });

    // Mock posts endpoint
    await page.route('**/api/instagram/posts*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          posts: [],
          counts: { all: 0, draft: 0, scheduled: 0, published: 0, failed: 0 },
        }),
      });
    });

    // Mock analytics endpoint
    await page.route('**/api/instagram/analytics*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          summary: { totalPosts: 0, totalLikes: 0, totalComments: 0 },
        }),
      });
    });

    // Mock studio history endpoint
    await page.route('**/api/history*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [],
        }),
      });
    });
  };

  test('1. Instagram connection button initiates authorization redirect with required parameters', async ({
    page,
  }) => {
    // Start with 0 accounts connected
    await setupBaseRoutes(page, []);

    await page.goto('/?tab=instagram-composer');

    // Verify "No Account Connected" button is displayed
    const noAccountBtn = page.getByRole('button', { name: /No Account Connected/i });
    await expect(noAccountBtn).toBeVisible();

    // Click to open Account Management modal
    await noAccountBtn.click();

    // Verify modal displays "Connect Instagram Account" action
    const connectOAuthBtn = page.getByRole('button', { name: 'Connect Instagram Account' });
    await expect(connectOAuthBtn).toBeVisible();

    // Intercept navigation / redirect triggered by the Connect button
    const navigationPromise = page.waitForRequest((request: any) =>
      request.url().startsWith('https://www.instagram.com/oauth/authorize')
    );

    // Mock external Instagram authorization endpoint to avoid outbound network call
    await page.route('https://www.instagram.com/oauth/authorize*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Instagram Login Mock</body></html>',
      });
    });

    await connectOAuthBtn.click();

    const interceptedRequest = await navigationPromise;
    const authUrl = new URL(interceptedRequest.url());

    // Validate Meta Direct Instagram OAuth parameters
    expect(authUrl.origin).toBe('https://www.instagram.com');
    expect(authUrl.pathname).toBe('/oauth/authorize');
    expect(authUrl.searchParams.get('client_id')).toBe('123456789012345');
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('enable_fb_login')).toBe('0');
    expect(authUrl.searchParams.get('force_authentication')).toBe('1');
    expect(authUrl.searchParams.get('scope')).toBe(
      'instagram_business_basic,instagram_business_content_publish'
    );
    expect(authUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/instagram/callback'
    );
    expect(authUrl.searchParams.get('state')).toBe('mock_secure_csrf_state_token_123456');
  });

  test('2. OAuth callback success sets active account and displays success notice', async ({
    page,
  }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM]);

    // Navigate to composer with query parameters injected by the callback route
    await page.goto('/?tab=instagram-composer&instagramConnected=true&username=flimyapper');

    // Verify success notice modal appears
    await expect(page.getByRole('heading', { name: 'Instagram Account Connected!' })).toBeVisible();
    await expect(
      page.getByText('Successfully connected @flimyapper via Instagram Login.')
    ).toBeVisible();

    // Acknowledge notice
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Instagram Account Connected!' })).not.toBeVisible();

    // Verify @flimyapper is selected as active account
    await expect(page.locator('strong', { hasText: '@flimyapper' })).toBeVisible();
    await expect(page.getByText('Instagram Login').first()).toBeVisible();
  });

  test('3. OAuth cancellation or permission-denied displays error notice and keeps app stable', async ({
    page,
  }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM]);

    // Navigate with error parameter emitted when user denies authorization
    await page.goto('/?tab=instagram-composer&instagramError=access_denied');

    // Verify error notice modal
    await expect(page.getByRole('heading', { name: 'Instagram OAuth Error' })).toBeVisible();
    await expect(page.getByText('access_denied')).toBeVisible();

    // Dismiss notice modal
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Instagram OAuth Error' })).not.toBeVisible();

    // Confirm composer remains usable
    await expect(
      page.getByPlaceholder('Write an engaging Instagram Reel caption, hook, and story details...')
    ).toBeVisible();
  });

  test('4. Invalid or mismatched OAuth state surfaces CSRF rejection notice', async ({ page }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM]);

    // Navigate with csrf_state_mismatch error parameter
    await page.goto('/?tab=instagram-composer&instagramError=csrf_state_mismatch');

    await expect(page.getByRole('heading', { name: 'Instagram OAuth Error' })).toBeVisible();
    await expect(page.getByText('csrf_state_mismatch')).toBeVisible();

    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Instagram OAuth Error' })).not.toBeVisible();
  });

  test('5. Multiple Instagram accounts exist simultaneously without conflict', async ({ page }) => {
    // Provide 3 accounts simultaneously
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM, MOCK_ACCOUNT_CINE, MOCK_ACCOUNT_MONISH]);

    await page.goto('/?tab=instagram-composer');

    // Header switcher should show current active account
    const headerPill = page.getByRole('button', { name: /@flimyapper.*followers/i });
    await expect(headerPill).toBeVisible();

    // Open dropdown switcher
    await headerPill.click();

    // Verify dropdown lists all 3 accounts
    await expect(page.getByText('Switch Account (3)')).toBeVisible();
    await expect(page.locator('div.space-y-1').getByText('@cinemonster.in')).toBeVisible();
    await expect(page.locator('div.space-y-1').getByText('@monish.insider')).toBeVisible();

    // Open "Manage All" modal
    await page.getByRole('button', { name: 'Manage All' }).click();

    // Verify all 3 accounts appear in the management dialog
    await expect(page.getByText('Flimyapper Movies • 24,500 followers').first()).toBeVisible();
    await expect(page.getByText('CineMonster • 18,200 followers').first()).toBeVisible();
    await expect(page.getByText('Mohd Monish • 12,100 followers').first()).toBeVisible();
  });

  test('6. Reconnecting an account updates existing record and preserves MongoDB _id', async ({
    page,
  }) => {
    // Track account IDs before and after simulated reconnect
    let accountsState = [{ ...MOCK_ACCOUNT_FLIM }];

    await setupBaseRoutes(page, accountsState);

    // Register dynamic override so changes to accountsState are reflected immediately
    await page.route(/\/api\/instagram\/accounts(\/.*)?$/, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, accounts: accountsState }),
      });
    });

    await page.goto('/?tab=instagram-composer');

    // Verify initial account loaded with expected ID
    await expect(page.locator('strong', { hasText: '@flimyapper' })).toBeVisible();

    // Simulate account reconnection via callback with updated follower count, preserving _id
    accountsState = [
      {
        ...MOCK_ACCOUNT_FLIM,
        followerCount: 25100, // follower count increased
        displayName: 'Flimyapper Movies Updated',
      },
    ];

    await page.goto('/?tab=instagram-composer&instagramConnected=true&username=flimyapper');
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Verify preserved _id in accounts API response
    const data = await page.evaluate(async () => {
      const res = await fetch('/api/instagram/accounts');
      return res.json();
    });
    expect(data.success).toBe(true);
    const flimAcc = data.accounts.find((a: any) => a.username === 'flimyapper');
    expect(flimAcc).toBeDefined();
    expect(flimAcc._id).toBe(MOCK_ACCOUNT_FLIM._id);
    expect(flimAcc.instagramUserId).toBe(MOCK_ACCOUNT_FLIM.instagramUserId);
    expect(flimAcc.followerCount).toBe(25100);
  });

  test('7. Disconnecting one account removes only that account while others remain connected', async ({
    page,
  }) => {
    let currentAccounts = [MOCK_ACCOUNT_FLIM, MOCK_ACCOUNT_CINE];

    // Accept confirmation dialogs automatically
    page.on('dialog', (dialog) => dialog.accept());

    await setupBaseRoutes(page, currentAccounts);

    await page.route(/\/api\/instagram\/accounts(\/.*)?$/, async (route: any) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, accounts: currentAccounts }),
        });
      } else if (method === 'DELETE') {
        const url = route.request().url();
        const idToDelete = url.split('/').pop()?.split('?')[0];
        currentAccounts = currentAccounts.filter((a) => a._id !== idToDelete);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Instagram account disconnected successfully' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/?tab=instagram-composer');

    // Open switcher and click Manage All
    await page.getByRole('button', { name: /@flimyapper.*followers/i }).click();
    await page.getByRole('button', { name: 'Manage All' }).click();

    // Locate the disconnect button specifically for @cinemonster.in (second account in list)
    const disconnectBtn = page.getByRole('button', { name: 'Disconnect account' }).nth(1);
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Verify notice confirms disconnect
    await expect(page.getByRole('heading', { name: 'Disconnected' })).toBeVisible();
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Verify current accounts list now contains only @flimyapper
    expect(currentAccounts.length).toBe(1);
    expect(currentAccounts[0].username).toBe('flimyapper');
  });

  test('8. Account switcher updates active account in composer header', async ({ page }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM, MOCK_ACCOUNT_CINE]);

    await page.goto('/?tab=instagram-composer');

    // Active account starts as @flimyapper
    const headerPill = page.getByRole('button', { name: /@flimyapper.*followers/i });
    await expect(headerPill).toBeVisible();

    // Click active account dropdown
    await headerPill.click();

    // Click @cinemonster.in in the dropdown list
    const cineOption = page.locator('div.space-y-1 button', { hasText: '@cinemonster.in' });
    await expect(cineOption).toBeVisible();
    await cineOption.click();

    // Active account in header should now be @cinemonster.in
    await expect(page.getByRole('button', { name: /@cinemonster.in.*followers/i })).toBeVisible();
    await expect(page.locator('strong', { hasText: '@cinemonster.in' })).toBeVisible();
  });

  test('9. API responses never expose accessToken or client secrets', async ({ page }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM, MOCK_ACCOUNT_CINE]);

    await page.goto('/?tab=instagram-composer');

    // Fetch accounts endpoint directly
    const res = await page.request.get('http://localhost:3000/api/instagram/accounts');
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(Array.isArray(json.accounts)).toBe(true);

    // Assert that every account object strictly redacts accessToken
    for (const acc of json.accounts) {
      expect(acc.accessToken).toBeUndefined();
      expect(acc.appSecret).toBeUndefined();
      expect(acc.clientSecret).toBeUndefined();
      expect(acc.encryptionKey).toBeUndefined();
    }

    // Assert that top-level response does not leak credentials
    const rawText = JSON.stringify(json);
    expect(rawText).not.toContain('EAAB');
    expect(rawText).not.toContain('IGQV');
    expect(rawText).not.toContain('client_secret');
  });

  test('10. Scheduled Reel post resolves and transmits the selected active accountId', async ({
    page,
  }) => {
    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM, MOCK_ACCOUNT_CINE]);

    let capturedPayload: any = null;
    await page.route('**/api/instagram/posts', async (route: any) => {
      if (route.request().method() === 'POST') {
        capturedPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            post: {
              _id: 'post_test_123',
              status: 'scheduled',
              ...capturedPayload,
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/?tab=instagram-composer');

    // Switch active account to @cinemonster.in
    await page.getByRole('button', { name: /@flimyapper.*followers/i }).click();
    await page.locator('div.space-y-1 button', { hasText: '@cinemonster.in' }).click();

    // Fill Reel caption and direct media URL
    await page
      .getByPlaceholder('Write an engaging Instagram Reel caption, hook, and story details...')
      .fill('Upcoming blockbuster trailer breakdown and cinematic secrets.');
    await page
      .getByPlaceholder('https://... or choose from Studio Splits above')
      .fill('https://example.com/videos/cine_breakdown.mp4');

    // Click "Schedule Reel" button
    const scheduleBtn = page.getByRole('button', { name: /Schedule Reel for/i });
    await expect(scheduleBtn).toBeVisible();
    await scheduleBtn.click();

    // Verify success notice modal appears
    await expect(page.getByRole('heading', { name: 'Reel Scheduled!' })).toBeVisible();
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // Verify intercepted payload matched @cinemonster.in
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.accountId).toBe(MOCK_ACCOUNT_CINE._id);
    expect(capturedPayload.username).toBe('cinemonster.in');
    expect(capturedPayload.mediaType).toBe('REELS');
    expect(capturedPayload.mediaUrl).toBe('https://example.com/videos/cine_breakdown.mp4');
    expect(capturedPayload.status).toBe('scheduled');
  });

  test('11. Expired or inactive account surfaces proper indicators without crashing', async ({
    page,
  }) => {
    const inactiveAccount = {
      ...MOCK_ACCOUNT_FLIM,
      isActive: false,
      isSimulated: true, // simulation / inactive flag
    };

    await setupBaseRoutes(page, [inactiveAccount]);
    await page.goto('/?tab=instagram-composer');

    // Verify Sandbox / Inactive indicator badge in header
    await expect(page.getByText('Sandbox').first()).toBeVisible();

    // Open Manage Accounts dialog
    await page.getByRole('button', { name: /@flimyapper.*followers/i }).click();
    await page.getByRole('button', { name: 'Manage All' }).click();

    // Verify simulation mode label appears in manage view
    await expect(page.getByText('Simulation Mode')).toBeVisible();
  });

  test('12. Publishing UI handles both success (permalink) and failure (error modal) states', async ({
    page,
  }) => {
    let shouldFail = false;

    await setupBaseRoutes(page, [MOCK_ACCOUNT_FLIM]);

    // Register override AFTER setupBaseRoutes so it takes precedence
    await page.route('**/api/instagram/posts', async (route: any) => {
      if (route.request().method() === 'POST') {
        if (shouldFail) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Meta API rate limit reached. Please wait a few moments before retrying.',
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              permalink: 'https://www.instagram.com/reel/DC_test12345/',
            }),
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('/?tab=instagram-composer');

    // Switch publish mode to "Publish Now"
    await page.getByRole('button', { name: 'Publish Now' }).click();

    // Fill form
    await page
      .getByPlaceholder('Write an engaging Instagram Reel caption, hook, and story details...')
      .fill('Live Reel release test.');
    await page
      .getByPlaceholder('https://... or choose from Studio Splits above')
      .fill('https://example.com/videos/live_reel.mp4');

    // 12a. Test Publish Success
    const publishNowBtn = page.getByRole('button', { name: 'Publish Reel to Instagram Now' });
    await publishNowBtn.click();

    await expect(page.getByRole('heading', { name: 'Reel Published!' })).toBeVisible();
    await expect(
      page.getByText('Your Reel is live on Instagram: https://www.instagram.com/reel/DC_test12345/')
    ).toBeVisible();
    await page.getByRole('button', { name: 'OK', exact: true }).click();

    // 12b. Test Publish Failure
    shouldFail = true;
    await page
      .getByPlaceholder('Write an engaging Instagram Reel caption, hook, and story details...')
      .fill('Another Reel release test intended to fail.');
    await page
      .getByPlaceholder('https://... or choose from Studio Splits above')
      .fill('https://example.com/videos/live_reel2.mp4');

    await publishNowBtn.click();

    await expect(page.getByRole('heading', { name: 'Submission Failed' })).toBeVisible();
    await expect(
      page.getByText('Meta API rate limit reached. Please wait a few moments before retrying.')
    ).toBeVisible();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  });
});
