import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function colorChannels(color: string): [number, number, number] {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Unsupported color: ${color}`);
  }
  return channels as [number, number, number];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const linearize = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const [red, green, blue] = colorChannels(color);
    return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function expectVisibleFocus(locator: Locator) {
  const style = await locator.evaluate((element) => {
    const browser = globalThis as typeof globalThis & {
      getComputedStyle: (target: unknown) => { outlineColor: string; outlineStyle: string; outlineWidth: string };
    };
    const computedStyle = browser.getComputedStyle(element);
    return {
      color: computedStyle.outlineColor,
      style: computedStyle.outlineStyle,
      width: Number.parseFloat(computedStyle.outlineWidth),
    };
  });

  expect(style.style).not.toBe('none');
  expect(style.width).toBeGreaterThanOrEqual(2);
  expect(contrastRatio(style.color, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(3);
}

async function expectGroupsDoNotOverlap(page: Page) {
  const boxes = await Promise.all(
    ['.header__brand', '.header__controls', '.header__actions'].map((selector) => page.locator(selector).boundingBox()),
  );

  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }

  for (let first = 0; first < boxes.length; first++) {
    for (let second = first + 1; second < boxes.length; second++) {
      const a = boxes[first]!;
      const b = boxes[second]!;
      const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      expect(overlapWidth * overlapHeight).toBe(0);
    }
  }
}

async function controlsShareBrandRow(page: Page) {
  const [brand, controls] = await Promise.all([
    page.locator('.header__brand').boundingBox(),
    page.locator('.header__controls').boundingBox(),
  ]);

  expect(brand).not.toBeNull();
  expect(controls).not.toBeNull();
  return Math.min(brand!.y + brand!.height, controls!.y + controls!.height) > Math.max(brand!.y, controls!.y);
}

async function expectNoAutomatedViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('names the editor fields and exposes visible high-contrast focus', async ({ page }) => {
    const original = page.getByRole('textbox', { name: 'Original', exact: true });
    const modified = page.getByRole('textbox', { name: 'Modified', exact: true });
    await expect(original).toBeVisible();
    await expect(modified).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);

    const compare = page.getByRole('button', { name: 'Compare', exact: true });
    await compare.focus();
    await expectVisibleFocus(compare);
    await original.focus();
    await expectVisibleFocus(original);

    const placeholderColor = await original.evaluate((element) => {
      const browser = globalThis as typeof globalThis & {
        getComputedStyle: (target: unknown, pseudoElement?: string) => { color: string };
      };
      return browser.getComputedStyle(element, '::placeholder').color;
    });
    expect(contrastRatio(placeholderColor, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5);
  });

  test('contains modal focus, supports Escape, restores the opener, and preserves list semantics', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'About' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'About TextDiffTool' });
    const headerClose = dialog.locator('.modal__close');
    const footerClose = dialog.locator('.modal__footer').getByRole('button', { name: 'Close' });
    await expect(dialog).toBeVisible();
    await expect(headerClose).toBeFocused();
    await expect(dialog.getByRole('list')).toHaveCount(2);
    await expect(dialog.getByRole('img')).toHaveCount(0);

    await page.locator('#original').evaluate((element) => (element as { focus: () => void }).focus());
    await expect(headerClose).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(footerClose).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(headerClose).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('gives settings controls concise names, descriptions, and keyboard focus indicators', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diff settings' });
    await expect(dialog).toHaveAccessibleDescription('Choose how the next comparison is calculated and displayed.');

    const selectedDiffMode = dialog.getByRole('radio', { name: /Line then grapheme/ });
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.keyboard.press('Tab');
      if (await selectedDiffMode.evaluate((element) => element === element.ownerDocument.activeElement)) {
        break;
      }
    }
    await expect(selectedDiffMode).toBeFocused();
    await expectVisibleFocus(selectedDiffMode.locator('..'));

    const efficiencyCleanup = dialog.getByRole('radio', { name: /Efficiency Cleanup/ });
    await dialog.getByText('Efficiency Cleanup', { exact: true }).click();
    await expect(efficiencyCleanup).toBeChecked();
    const editCost = dialog.getByRole('spinbutton', { name: 'Edit cost', exact: true });
    await expect(editCost).toBeEnabled();
    await expect(editCost).toHaveAccessibleDescription('Merge equalities shorter than this cost.');
    await editCost.focus();
    await expectVisibleFocus(editCost);
  });

  test('exposes comparison structure, line changes, and keyboard disclosure controls', async ({ page }) => {
    const originalLines = Array.from({ length: 21 }, (_, index) => `Line ${index + 1}`);
    const modifiedLines = [...originalLines];
    originalLines[10] = 'abc';
    modifiedLines[10] = 'axc';

    await page.getByRole('textbox', { name: 'Original', exact: true }).fill(originalLines.join('\n'));
    await page.getByRole('textbox', { name: 'Modified', exact: true }).fill(modifiedLines.join('\n'));
    await page.getByRole('button', { name: 'Compare' }).click();

    await expect(page.getByRole('status')).toHaveText('Comparison complete. Results are ready.');
    await expect(page.getByRole('main', { name: 'Comparison results' })).toBeVisible();
    const table = page.getByRole('table', { name: 'Original and modified text comparison' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader')).toHaveText(['Original', 'Modified']);
    await expect(table.getByRole('cell').first()).toBeVisible();

    const deletion = table.getByRole('deletion');
    const insertion = table.getByRole('insertion');
    await expect(deletion).toHaveText('b');
    await expect(deletion).toHaveAccessibleDescription('Deleted text');
    await expect(insertion).toHaveText('x');
    await expect(insertion).toHaveAccessibleDescription('Inserted text');

    const disclosure = table.locator('.compare-display__collapsed').first();
    await expect(disclosure).toHaveAccessibleName('7 unchanged lines hidden');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const controlledId = await disclosure.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    const controlledLines = page.locator(`#${controlledId}`);
    await expect(controlledLines).toBeHidden();

    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAccessibleName('Collapse 7 unchanged lines');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(controlledLines).toBeVisible();
    await expect(disclosure).toBeFocused();

    await page.keyboard.press('Space');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(controlledLines).toBeHidden();
  });

  test('makes long comparison results keyboard-scrollable', async ({ page }) => {
    const original = Array.from({ length: 80 }, (_, index) => `Original line ${index + 1}`).join('\n');
    const modified = Array.from({ length: 80 }, (_, index) => `Modified line ${index + 1}`).join('\n');
    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);
    await page.locator('#compare-btn').click();

    const viewport = page.locator('.compare-display__content');
    await viewport.focus();
    await expect(viewport).toBeFocused();
    await expectVisibleFocus(viewport);
    await page.keyboard.press('PageDown');
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('reflows header controls without clipping across viewport and text sizes', async ({ page }) => {
    await test.step('narrow viewports', async () => {
      for (const width of [375, 320]) {
        await page.setViewportSize({ width, height: 667 });
        await expectGroupsDoNotOverlap(page);
        expect(
          await page.evaluate(
            () =>
              (
                globalThis as typeof globalThis & {
                  document: { documentElement: { scrollWidth: number } };
                }
              ).document.documentElement.scrollWidth,
          ),
        ).toBeLessThanOrEqual(width);
      }

      await page.getByRole('button', { name: 'About' }).click();
      await expect(page.getByRole('dialog', { name: 'About TextDiffTool' })).toBeVisible();
      await page.keyboard.press('Escape');
    });

    await test.step('responsive breakpoint', async () => {
      await page.setViewportSize({ width: 700, height: 667 });
      expect(await controlsShareBrandRow(page)).toBe(false);
      await expectGroupsDoNotOverlap(page);

      await page.setViewportSize({ width: 800, height: 667 });
      expect(await controlsShareBrandRow(page)).toBe(true);
      await expectGroupsDoNotOverlap(page);
    });

    await test.step('200 percent text size', async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.evaluate(() => {
        (
          globalThis as typeof globalThis & {
            document: { documentElement: { style: { fontSize: string } } };
          }
        ).document.documentElement.style.fontSize = '200%';
      });

      await expectGroupsDoNotOverlap(page);
      expect(
        await page
          .locator('#compare-btn, #settings-btn')
          .evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth)),
      ).toBe(true);
    });
  });

  test('passes automated checks in the primary UI states', async ({ page }) => {
    await expectNoAutomatedViolations(page);

    await page.getByRole('button', { name: 'Settings' }).click();
    await expectNoAutomatedViolations(page);
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'About' }).click();
    await expectNoAutomatedViolations(page);
    await page.keyboard.press('Escape');

    const originalLines = Array.from({ length: 21 }, (_, index) => `Line ${index + 1}`);
    const modifiedLines = [...originalLines];
    originalLines[10] = 'before';
    modifiedLines[10] = 'after';
    await page.locator('#original').fill(originalLines.join('\n'));
    await page.locator('#modified').fill(modifiedLines.join('\n'));
    await page.locator('#compare-btn').click();
    await expectNoAutomatedViolations(page);

    await page.locator('.compare-display__collapsed').first().click();
    await expectNoAutomatedViolations(page);

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('.header__toggle').click();
    await page.locator('#original').fill('{"valid":true}');
    await page.locator('#modified').fill('{"invalid"');
    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.getByRole('dialog', { name: /JSON Parse Error/ })).toBeVisible();
    await expectNoAutomatedViolations(page);
  });
});
