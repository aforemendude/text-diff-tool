import { expect, test } from '@playwright/test';

test.describe('Diff processing', () => {
  test('runs a comparison in a dedicated worker', async ({ page }) => {
    await page.goto('/');
    await page.locator('#original').fill('before');
    await page.locator('#modified').fill('after');

    const workerStarted = page.waitForEvent('worker');
    await page.locator('#compare-btn').click();

    const worker = await workerStarted;
    expect(worker.url()).toContain('diffWorker');
    await expect(page.locator('.compare-display')).toBeVisible();
  });

  test('keeps the processing modal open until the user terminates the worker', async ({ page }) => {
    await page.addInitScript(() => {
      const state = { terminateCount: 0 };
      Object.defineProperty(globalThis, '__diffWorkerTestState', { value: state });

      class PendingWorker {
        onmessage: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;

        postMessage() {}

        terminate() {
          state.terminateCount += 1;
        }
      }

      Object.defineProperty(globalThis, 'Worker', { configurable: true, value: PendingWorker });
    });

    await page.goto('/');
    await page.locator('#original').fill('before');
    await page.locator('#modified').fill('after');
    await page.locator('#compare-btn').click();

    const dialog = page.getByRole('dialog', { name: 'Comparing Text' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0);

    await page.locator('.modal__overlay').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Terminate' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('#original')).toHaveValue('before');
    await expect(page.locator('#modified')).toHaveValue('after');
    await expect(page.locator('.compare-display')).not.toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (globalThis as typeof globalThis & { __diffWorkerTestState: { terminateCount: number } })
              .__diffWorkerTestState.terminateCount,
        ),
      )
      .toBe(1);
  });
});
