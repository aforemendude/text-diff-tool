import { expect, test } from '@playwright/test';

test('uses a development-only CSP for Vite hot-module reload', async ({ page }) => {
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
  const viteClient = page.locator('script[src$="/@vite/client"]');

  if ((await viteClient.count()) === 0) {
    expect(connectSources).toBeUndefined();
    return;
  }

  const webSocketEndpoint = new URL(page.url());
  webSocketEndpoint.protocol = webSocketEndpoint.protocol === 'https:' ? 'wss:' : 'ws:';
  expect(connectSources).toContain(webSocketEndpoint.href);
  await expect.poll(() => consoleMessages).toContain('[vite] connected.');
});
