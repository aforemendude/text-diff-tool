import { expect, test, type Page } from '@playwright/test';

async function loadFramedApp(page: Page, baseURL: string | undefined, sandboxed = false) {
  if (!baseURL) {
    throw new Error('Playwright must provide a base URL for the application.');
  }

  const appUrl = new URL('/', baseURL).href;
  const sandbox = sandboxed ? ' sandbox' : '';

  await page.setContent(`<iframe title="TextDiffTool"${sandbox} src="${appUrl}"></iframe>`);
}

test('uses an environment-specific CSP in development and preview', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', (message) => consoleMessages.push(message.text()));

  await page.goto('/');

  const contentSecurityPolicy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(contentSecurityPolicy).not.toBeNull();

  const connectSources = contentSecurityPolicy
    ?.split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .find(([directive]) => directive === 'connect-src')
    ?.slice(1);
  const isDevelopmentServer = (await page.locator('script[src$="/@vite/client"]').count()) > 0;

  if (isDevelopmentServer) {
    const webSocketEndpoint = new URL(page.url());
    webSocketEndpoint.protocol = webSocketEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    expect(connectSources).toContain(webSocketEndpoint.href);
    await expect.poll(() => consoleMessages).toContain('[vite] connected.');
  } else {
    expect(connectSources).toBeUndefined();
  }
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
