import { expect, test, type Page } from '@playwright/test';

async function loadFramedApp(page: Page, baseURL: string | undefined, sandboxed = false) {
  if (!baseURL) {
    throw new Error('Playwright must provide a base URL for the application.');
  }

  const appUrl = new URL('/', baseURL).href;
  const attackerUrl = new URL('/text-diff-tool/vendor_patch.js', baseURL);
  attackerUrl.hostname = attackerUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  const sandbox = sandboxed ? ' sandbox' : '';

  await page.goto(attackerUrl.href);
  await page.setContent(`<iframe title="TextDiffTool"${sandbox} src="${appUrl}"></iframe>`);
}

test('renders normally as the top-level document', async ({ page }) => {
  await page.goto('/');

  const body = page.locator('body');
  await expect(body).not.toHaveAttribute('hidden', '');
  await expect(body).not.toHaveAttribute('inert', '');
  await expect(page.locator('.app')).toBeVisible();
});

test('stays hidden and inert inside a cross-origin frame', async ({ page, baseURL }) => {
  await loadFramedApp(page, baseURL);

  const frame = page.frameLocator('iframe[title="TextDiffTool"]');
  await expect(frame.locator('body')).toHaveAttribute('hidden', '');
  await expect(frame.locator('body')).toHaveAttribute('inert', '');
  await expect(frame.locator('body')).toBeHidden();
  await expect(frame.locator('.app')).toHaveCount(0);
  expect(page.workers()).toEqual([]);
});

test('stays hidden when iframe sandboxing disables scripts', async ({ page, baseURL }) => {
  await loadFramedApp(page, baseURL, true);

  const frame = page.frameLocator('iframe[title="TextDiffTool"]');
  await expect(frame.locator('body')).toHaveAttribute('hidden', '');
  await expect(frame.locator('body')).toHaveAttribute('inert', '');
  await expect(frame.locator('body')).toBeHidden();
  await expect(frame.locator('.app')).toHaveCount(0);
  expect(page.workers()).toEqual([]);
});
