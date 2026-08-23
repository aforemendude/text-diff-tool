import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Diff processing', () => {
  test('loads one dedicated worker with the page and reuses it for consecutive comparisons', async ({ page }) => {
    const workerStarted = page.waitForEvent('worker');
    await page.goto('/');
    const worker = await workerStarted;
    const isDevelopmentServer = (await page.locator('script[src$="/@vite/client"]').count()) > 0;

    if (isDevelopmentServer) {
      expect(worker.url()).toContain('worker');
    } else {
      expect(worker.url()).toMatch(/^blob:/);
    }

    await page.locator('#original').fill('before');
    await page.locator('#modified').fill('after');
    await page.locator('#compare-btn').click();
    await expect(page.locator('.compare-display')).toBeVisible();

    await page.locator('#compare-btn').click();
    await page.locator('#modified').fill('after again');
    await page.locator('#compare-btn').click();
    await expect(page.locator('.compare-display')).toBeVisible();

    expect(page.workers()).toEqual([worker]);
  });

  test('keeps the processing modal open until the user terminates the worker', async ({ page }) => {
    await page.addInitScript(() => {
      const state = { createCount: 0, postMessageCount: 0, terminateCount: 0 };
      Object.defineProperty(globalThis, '__diffWorkerTestState', { value: state });

      class PendingWorker {
        onmessage: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;

        constructor() {
          state.createCount += 1;
        }

        addEventListener() {
          // Vite listens for worker startup errors so it can revoke the inline worker's blob URL.
        }

        postMessage() {
          state.postMessageCount += 1;
        }

        terminate() {
          state.terminateCount += 1;
        }
      }

      Object.defineProperty(globalThis, 'Worker', { configurable: true, value: PendingWorker });
    });

    await page.goto('/');
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                __diffWorkerTestState: { createCount: number };
              }
            ).__diffWorkerTestState.createCount,
        ),
      )
      .toBe(1);
    await page.locator('#original').fill('before');
    await page.locator('#modified').fill('after');
    await page.locator('#compare-btn').click();

    const dialog = page.getByRole('dialog', { name: 'Comparing Text' });
    const terminate = dialog.getByRole('button', { name: 'Terminate' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0);
    await expect(terminate).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(terminate).toBeFocused();

    const accessibilityResults = await new AxeBuilder({ page }).analyze();
    expect(
      accessibilityResults.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        targets: violation.nodes.map((node) => node.target),
      })),
    ).toEqual([]);

    await page.locator('.modal__overlay').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await terminate.click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('#original')).toHaveValue('before');
    await expect(page.locator('#modified')).toHaveValue('after');
    await expect(page.locator('.compare-display')).not.toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              globalThis as typeof globalThis & {
                __diffWorkerTestState: { createCount: number; postMessageCount: number; terminateCount: number };
              }
            ).__diffWorkerTestState,
        ),
      )
      .toEqual({ createCount: 2, postMessageCount: 1, terminateCount: 1 });
  });
});
