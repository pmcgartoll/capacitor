import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.join(__dirname, '../../../.tmp/hush-artifacts');

/** Set a range input and fire the same events a finger would. */
async function setRange(page, testId, value) {
  await page.getByTestId(testId).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('Hush web', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => {
      throw new Error(`pageerror: ${err.message}`);
    });
  });

  test('loads, plays, and reduces volume when simulated battery drops', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // audio=mock: Linux WebKit often lacks a usable AudioContext in headless CI.
    await page.goto('/?sim=1&audio=mock&level=1&charging=0');

    await expect(page.getByRole('heading', { name: 'HUSH' })).toBeVisible();
    await expect(page.getByTestId('sim-panel')).toBeVisible();
    await expect(page.getByTestId('effective-volume')).toHaveText('55%');

    await page.getByRole('button', { name: /Play white noise/i }).click();
    await expect(page.getByTestId('status')).toContainText(/Playing/i);
    await expect(page.getByRole('button', { name: /Pause white noise/i })).toBeVisible();

    // Drop into the 10–20% band → 55% multiplier → effective ~30%
    await setRange(page, 'sim-level', 15);
    await expect(page.getByTestId('saver-hint')).toBeVisible();
    await expect(page.getByTestId('effective-volume')).toHaveText('30%');
    await expect(page.getByTestId('status')).toContainText(/volume reduced/i);

    // Charging restores full user volume
    await page.getByTestId('sim-charging').check();
    await expect(page.getByTestId('effective-volume')).toHaveText('55%');
    await expect(page.getByTestId('saver-hint')).toBeHidden();
    await expect(page.getByTestId('battery-detail')).toContainText(/Charging/i);

    const starts = await page.evaluate(() => window.__hush.audio.starts);
    expect(starts).toBeGreaterThan(0);

    const shot = path.join(artifacts, `${testInfo.project.name}-playing.png`);
    await page.screenshot({ path: shot, fullPage: true });
  });

  test('volume slider updates effective output at full battery', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?sim=1&audio=mock&level=1');

    await setRange(page, 'volume', 80);
    await expect(page.getByTestId('effective-volume')).toHaveText('80%');

    await setRange(page, 'sim-level', 5);
    // 80% * 0.30 = 24%
    await expect(page.getByTestId('effective-volume')).toHaveText('24%');
  });
});
