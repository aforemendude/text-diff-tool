import { expect, test, type Page } from '@playwright/test';

async function loadFramedApp(page: Page, baseURL: string | undefined, sandboxed = false) {
  if (!baseURL) {
    throw new Error('Playwright must provide a base URL for the application.');
  }

  const appUrl = new URL('/', baseURL).href;
  const sandbox = sandboxed ? ' sandbox' : '';

  await page.setContent(`<iframe title="TextDiffTool"${sandbox} src="${appUrl}"></iframe>`);
}

async function expectFramedAppHidden(page: Page) {
  const frame = page.frameLocator('iframe[title="TextDiffTool"]');
  await expect(frame.locator('body')).toHaveAttribute('hidden', '');
  await expect(frame.locator('body')).toHaveAttribute('inert', '');
  await expect(frame.locator('body')).toBeHidden();
  await expect(frame.locator('.app')).toHaveCount(0);
  expect(page.workers()).toEqual([]);
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

  const fontSources = contentSecurityPolicy
    ?.split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .find(([directive]) => directive === 'font-src')
    ?.slice(1);
  expect(fontSources).toEqual(["'self'"]);

  const workerSources = contentSecurityPolicy
    ?.split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .find(([directive]) => directive === 'worker-src')
    ?.slice(1);
  expect(workerSources).toEqual(["'self'", 'blob:']);

  if (isDevelopmentServer) {
    const webSocketEndpoint = new URL(page.url());
    webSocketEndpoint.protocol = webSocketEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    expect(connectSources).toContain(webSocketEndpoint.href);
    await expect.poll(() => consoleMessages).toContain('[vite] connected.');
  } else {
    expect(connectSources).toBeUndefined();
  }
});

test('loads bundled fonts without a runtime font CDN', async ({ page }) => {
  const requestUrls: string[] = [];
  const fontResponses: { url: string; ok: boolean }[] = [];

  page.on('request', (request) => requestUrls.push(request.url()));
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') {
      fontResponses.push({ url: response.url(), ok: response.ok() });
    }
  });

  await page.goto('/');
  await page.evaluate(async () => {
    const fontSet = (
      globalThis as unknown as {
        document: { fonts: { load: (font: string, text?: string) => Promise<unknown> } };
      }
    ).document.fonts;

    await Promise.all([
      fontSet.load('400 16px Inter', 'TextDiffTool'),
      fontSet.load('400 16px "JetBrains Mono"', 'editable text'),
      fontSet.load('italic 400 16px "JetBrains Mono"', 'italic marker'),
    ]);
  });

  const pageOrigin = new URL(page.url()).origin;
  expect(fontResponses.length).toBeGreaterThanOrEqual(3);
  expect(fontResponses.every((response) => response.ok && new URL(response.url).origin === pageOrigin)).toBe(true);
  expect(
    requestUrls.filter((url) => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(url).hostname)),
  ).toEqual([]);

  await expect(page.locator('body')).toHaveCSS('font-family', /Inter/);
  await expect(page.locator('#original')).toHaveCSS('font-family', /JetBrains Mono/);
  await expect(page.getByRole('button', { name: 'Compare' })).toHaveCSS('font-family', /Inter/);
});

test('stays hidden and inert in framed documents', async ({ page, baseURL }) => {
  await test.step('when scripts can detect the cross-origin frame', async () => {
    await loadFramedApp(page, baseURL);
    await expectFramedAppHidden(page);
  });

  await test.step('when iframe sandboxing disables scripts', async () => {
    await loadFramedApp(page, baseURL, true);
    await expectFramedAppHidden(page);
  });
});
