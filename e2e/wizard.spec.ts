import { test, expect } from '@playwright/test';

test.describe('VideoTimmer 6-Step Processing Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Step 1: Upload Zone is visible with supported container tags', async ({ page }) => {
    await expect(page.getByText(/Drag & drop your video here/i)).toBeVisible();
    await expect(page.getByText('Resumable 5MB Slices')).toBeVisible();
    await expect(page.getByText('Auto-Orientation / SAR Fix')).toBeVisible();
    await expect(page.getByText('VFR Drift Detection')).toBeVisible();
  });

  test('Step 2: Aspect Ratio & Reframe Modes can be selected', async ({ page }) => {
    // Navigate to Step 2
    const step2Btn = page.getByRole('button', { name: /Reframe & Aspect/i });
    await step2Btn.click();

    // Verify Target Aspect Ratio cards
    await expect(page.getByText('9:16 Vertical')).toBeVisible();
    await expect(page.getByText('1:1 Square')).toBeVisible();
    await expect(page.getByText('4:5 Portrait')).toBeVisible();
    await expect(page.getByText('16:9 Landscape')).toBeVisible();

    // Select 1:1 Square
    await page.getByText('1:1 Square').click();

    // Verify Reframe methods
    await expect(page.getByText('Blur Background (Fit)')).toBeVisible();
    await expect(page.getByText('Solid Bars (Letterbox)')).toBeVisible();
    await expect(page.getByText('Crop to Fill')).toBeVisible();

    // Select Crop to Fill
    await page.getByText('Crop to Fill').click();
  });

  test('Step 3: Splitting Engine configurations & preview calculations', async ({ page }) => {
    // Navigate to Step 3
    const step3Btn = page.getByRole('button', { name: /Split Plan/i });
    await step3Btn.click();

    await expect(page.getByText('Fixed Duration')).toBeVisible();
    await expect(page.getByText('Equal Parts')).toBeVisible();
    await expect(page.getByText('Custom Timestamps')).toBeVisible();

    // Check overlap and min-last-part controls
    await expect(page.getByText('Overlap Between Parts')).toBeVisible();
    await expect(page.getByText('Minimum Last-Part Length')).toBeVisible();
    await expect(page.getByText('Merge into previous')).toBeVisible();
    await expect(page.getByText('Keep as short part')).toBeVisible();

    // Switch to Equal Parts
    await page.getByText('Equal Parts').click();
    await expect(page.getByText('Total Number of Parts')).toBeVisible();
  });

  test('Step 4: Text Overlay slot controls & safe zone guide toggle', async ({ page }) => {
    // Navigate to Step 4
    const step4Btn = page.getByRole('button', { name: /Text Overlays/i });
    await step4Btn.click();

    await expect(page.getByRole('button', { name: 'Top Text Slot' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bottom Text Slot' })).toBeVisible();
    await expect(page.getByRole('button', { name: /AI Subtitles \(Gemini\)/i })).toBeVisible();
    await expect(page.getByText(/Enable top Text Slot/i)).toBeVisible();

    // Click on AI Subtitles tab
    await page.getByRole('button', { name: /AI Subtitles \(Gemini\)/i }).click();
    await expect(page.getByText(/Enable AI Subtitles \(Gemini\)/i)).toBeVisible();

    // Toggle AI Subtitles switch
    const subtitleSwitch = page.locator('input[type="checkbox"]').first();
    await subtitleSwitch.check({ force: true });
    await expect(page.getByText(/Generate Subtitles with Gemini AI/i)).toBeVisible();
    await expect(page.getByText(/Subtitle Font Size/i)).toBeVisible();
  });

  test('Step 5: Output quality preset & Destination selection', async ({ page }) => {
    // Navigate to Step 5
    const step5Btn = page.getByRole('button', { name: /Destination/i });
    await step5Btn.click();

    await expect(page.getByText('Step E: Output & Destination')).toBeVisible();
    await expect(page.getByText('Fast (Lower CPU)')).toBeVisible();
    await expect(page.getByText('Balanced (Standard)')).toBeVisible();
    await expect(page.getByText('High Quality')).toBeVisible();

    await expect(page.getByText('Local Server & ZIP Package')).toBeVisible();
    await expect(page.getByText('Google Drive Upload')).toBeVisible();
    await expect(page.getByText('Filename Template')).toBeVisible();
  });

  test('Step 6: Review & Launch engine summary cards', async ({ page }) => {
    // Navigate to Step 6
    const step6Btn = page.getByRole('button', { name: /Review & Render/i });
    await step6Btn.click();

    await expect(page.getByText('Step F: Review & Launch Engine')).toBeVisible();
    await expect(page.getByText('Source Video Facts')).toBeVisible();
    await expect(page.getByText('Reframing Recipe')).toBeVisible();
    await expect(page.getByText('Slicing Blueprint')).toBeVisible();
    await expect(page.getByText('Storage & Dispatch')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Processing/i })).toBeVisible();
  });

  test('Right Column: Live Frame Preview Canvas is always rendered', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Live Frame Canvas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Safe Zone' })).toBeVisible();
    await expect(page.getByText('Source Video:')).toBeVisible();
    await expect(page.getByText('Parts Calculated:')).toBeVisible();
  });
});
