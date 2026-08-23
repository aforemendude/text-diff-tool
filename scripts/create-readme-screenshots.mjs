import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VIEWPORT = { width: 1280, height: 720 };
const APPLICATION_PATH = '/text-diff-tool/';
const DEFAULT_SERVER_ORIGIN = 'http://127.0.0.1:5173';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const screenshotDirectory = path.join(repositoryRoot, 'screenshots');

const originalTextLines = [
  'Release plan: Aurora',
  'Owner: Platform team',
  'Target: 2026-09-01',
  'Region: eu-west-1',
  'Rollout: staged',
  'Canary traffic: 10%',
  'Metrics: enabled',
  'Alerts: configured',
  'Rollback: automatic',
  'Search flag: enabled',
  'Export flag: enabled',
  'Billing flag: disabled',
  'Notifications: enabled',
  'Audit log: 30 days',
  'Queue: priority',
  'Worker pool: 4 processes',
  'Retries: 3',
  'Backoff: exponential',
  'Timeout: 30 seconds',
  'Docs: published',
  'Runbook: reviewed',
  'Support: notified',
  'Approval: complete',
  'Deployment: scheduled',
  'Status: ready',
];

const modifiedTextLines = originalTextLines.map((line) => {
  if (line === 'Canary traffic: 10%') return 'Canary traffic: 25%';
  if (line === 'Queue: priority') return 'Queue: standard';
  if (line === 'Worker pool: 4 processes') return 'Worker pool: 6 processes';
  return line;
});

const originalJson = {
  application: {
    environment: 'production',
    name: 'TextDiffTool',
    region: 'eu-west-1',
    replicas: 3,
    version: '2.4.0',
  },
  authentication: {
    audience: 'text-diff-tool',
    issuer: 'accounts.example.com',
    sessionMinutes: 60,
  },
  cache: {
    provider: 'redis',
    ttlSeconds: 300,
  },
  database: {
    host: 'db.internal',
    name: 'textdiff',
    pool: {
      idleTimeoutSeconds: 30,
      maxConnections: 20,
      minConnections: 4,
    },
    port: 5432,
  },
  features: {
    auditLog: true,
    jsonMode: true,
    livePreview: false,
    semanticCleanup: true,
  },
  logging: {
    format: 'json',
    level: 'info',
    retentionDays: 14,
  },
  notifications: {
    channels: ['email', 'slack'],
    onFailure: true,
    onSuccess: false,
  },
  rateLimits: {
    burst: 50,
    perMinute: 120,
  },
  support: {
    email: 'support@example.com',
    hours: '24/7',
  },
};

const modifiedJson = {
  ...originalJson,
  application: { ...originalJson.application, version: '2.4.1' },
  database: {
    ...originalJson.database,
    pool: { ...originalJson.database.pool, maxConnections: 32 },
  },
  features: { ...originalJson.features, livePreview: true },
};

function resolveApplicationUrl() {
  const configuredBaseUrl = process.env.BASE_URL;
  const url = new URL(configuredBaseUrl || DEFAULT_SERVER_ORIGIN);

  if (url.pathname === '/') {
    url.pathname = APPLICATION_PATH;
  } else if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }

  return { isExternallyManaged: Boolean(configuredBaseUrl), url };
}

async function applicationIsReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;

    return (await response.text()).includes('<div id="app"');
  } catch {
    return false;
  }
}

async function waitForApplication(url, serverProcess) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (await applicationIsReady(url)) return;

    if (serverProcess.exitCode !== null) {
      throw new Error(`The Vite server exited before ${url.href} became available.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${url.href}.`);
}

async function startApplication(url, isExternallyManaged) {
  if (await applicationIsReady(url)) {
    console.log(`Reusing the application at ${url.href}`);
    return null;
  }

  if (isExternallyManaged) {
    throw new Error(`BASE_URL is set, but no application is available at ${url.href}.`);
  }

  const viteEntryPoint = path.join(repositoryRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const serverProcess = spawn(
    process.execPath,
    [viteEntryPoint, '--host', url.hostname, '--port', url.port, '--strictPort'],
    {
      cwd: repositoryRoot,
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );

  await waitForApplication(url, serverProcess);
  return serverProcess;
}

async function stopApplication(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null) return;

  serverProcess.kill('SIGTERM');
  await Promise.race([once(serverProcess, 'exit'), new Promise((resolve) => setTimeout(resolve, 5_000))]);

  if (serverProcess.exitCode === null) {
    serverProcess.kill('SIGKILL');
    await once(serverProcess, 'exit');
  }
}

async function clearScreenshotDirectory() {
  await mkdir(screenshotDirectory, { recursive: true });
  const entries = await readdir(screenshotDirectory);

  await Promise.all(
    entries.map((entry) => rm(path.join(screenshotDirectory, entry), { recursive: true, force: true })),
  );
}

async function loadApplication(page, url) {
  await page.goto(url.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}

async function fillInputs(page, original, modified) {
  await page.getByRole('textbox', { name: 'Original', exact: true }).fill(original);
  await page.getByRole('textbox', { name: 'Modified', exact: true }).fill(modified);
  await page.locator('textarea').evaluateAll((textareas) => {
    for (const textarea of textareas) {
      textarea.setSelectionRange(0, 0);
      textarea.scrollTop = 0;
      textarea.scrollLeft = 0;
    }
  });
  await page.locator('.header__brand').click();
}

async function enableJsonMode(page) {
  await page.getByText('JSON Mode', { exact: true }).click();
  if (!(await page.getByRole('checkbox', { name: 'JSON Mode' }).isChecked())) {
    throw new Error('JSON mode did not become enabled.');
  }
}

async function compare(page) {
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('table', { name: 'Original and modified text comparison' }).waitFor();
}

async function requireCollapsedSections(page, minimum) {
  const collapsedSectionCount = await page.locator('.compare-display__collapsed').count();
  if (collapsedSectionCount < minimum) {
    throw new Error(`Expected at least ${minimum} collapsed sections, but found ${collapsedSectionCount}.`);
  }
}

async function capture(page, filename) {
  const screenshotPath = path.join(screenshotDirectory, filename);
  await page.screenshot({
    path: screenshotPath,
    animations: 'disabled',
    caret: 'hide',
  });
  console.log(`Created ${path.relative(repositoryRoot, screenshotPath)}`);
}

async function createTextCompareScreenshot(page, applicationUrl) {
  await loadApplication(page, applicationUrl);
  await fillInputs(page, `${originalTextLines.join('\n')}\n`, modifiedTextLines.join('\n'));
  await compare(page);
  await requireCollapsedSections(page, 3);
  await page.getByText('New line at end of text', { exact: true }).waitFor();
  await page.getByText('No new line at end of text', { exact: true }).waitFor();
  await page.locator('.compare-display__content').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await capture(page, 'text_compare_mode.png');
}

async function loadJsonInputs(page, applicationUrl) {
  await loadApplication(page, applicationUrl);
  await enableJsonMode(page);
  await fillInputs(page, JSON.stringify(originalJson, null, 2), JSON.stringify(modifiedJson));
}

async function createJsonEditScreenshot(page, applicationUrl) {
  await loadJsonInputs(page, applicationUrl);
  await capture(page, 'json_edit_mode.png');
}

async function createJsonCompareScreenshot(page, applicationUrl) {
  await loadJsonInputs(page, applicationUrl);
  await compare(page);
  await requireCollapsedSections(page, 4);
  await page.locator('.compare-display__content').evaluate((element) => {
    element.scrollTop = 100;
  });
  await capture(page, 'json_compare_mode.png');
}

async function createSettingsModalScreenshot(page, applicationUrl) {
  await loadApplication(page, applicationUrl);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Diff settings' }).waitFor();
  const settingsBody = page.locator('.settings-modal__body');
  const isScrolledToBottom = await settingsBody.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollHeight - element.clientHeight - element.scrollTop <= 1;
  });
  if (!isScrolledToBottom) {
    throw new Error('The settings modal did not scroll to the bottom.');
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await capture(page, 'settings_modal.png');
}

const screenshotDefinitions = [
  { filename: 'text_compare_mode.png', create: createTextCompareScreenshot },
  { filename: 'json_edit_mode.png', create: createJsonEditScreenshot },
  { filename: 'json_compare_mode.png', create: createJsonCompareScreenshot },
  { filename: 'settings_modal.png', create: createSettingsModalScreenshot },
];

function resolveScreenshotSelection() {
  const requestedScreenshots = process.argv.slice(2);
  if (requestedScreenshots.length === 0) {
    return { definitions: screenshotDefinitions, shouldClearDirectory: true };
  }

  if (requestedScreenshots.length > 1) {
    throw new Error('Expected no more than one screenshot filename or basename.');
  }

  const requestedScreenshot = requestedScreenshots[0];
  const definition = screenshotDefinitions.find(
    ({ filename }) => requestedScreenshot === filename || requestedScreenshot === path.parse(filename).name,
  );
  if (!definition) {
    const availableScreenshots = screenshotDefinitions.map(({ filename }) => path.parse(filename).name).join(', ');
    throw new Error(`Unknown screenshot "${requestedScreenshot}". Choose one of: ${availableScreenshots}.`);
  }

  return { definitions: [definition], shouldClearDirectory: false };
}

async function main() {
  const { definitions, shouldClearDirectory } = resolveScreenshotSelection();
  const { isExternallyManaged, url: applicationUrl } = resolveApplicationUrl();
  if (shouldClearDirectory) {
    await clearScreenshotDirectory();
  } else {
    await mkdir(screenshotDirectory, { recursive: true });
  }

  let browser;
  let serverProcess;

  try {
    serverProcess = await startApplication(applicationUrl, isExternallyManaged);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'en-US',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const definition of definitions) {
      await definition.create(page, applicationUrl);
    }
  } finally {
    await browser?.close();
    await stopApplication(serverProcess);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
