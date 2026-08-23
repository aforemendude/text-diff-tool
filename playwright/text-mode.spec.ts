import { test, expect } from '@playwright/test';

test.describe('Text Mode Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const jsonModeToggle = page.locator('.header__toggle input[type="checkbox"]');
    await expect(jsonModeToggle).not.toBeChecked();
  });

  test('detects line and character changes and returns to edit mode', async ({ page }) => {
    const originalText = 'Line 1\nHello World\nLine 3';
    const modifiedText = 'Line 1\nHello There\nLine 3\nLine 4';

    await page.locator('#original').fill(originalText);
    await page.locator('#modified').fill(modifiedText);
    await page.locator('#compare-btn').click();

    const compareDisplay = page.locator('.compare-display');
    await expect(compareDisplay).toBeVisible();
    await expect(compareDisplay).toContainText('Line 1');
    await expect(compareDisplay).toContainText('Line 3');

    const originalLine = compareDisplay.locator('.diff-line--delete').filter({ hasText: 'Hello World' });
    const modifiedLine = compareDisplay.locator('.diff-line--insert').filter({ hasText: 'Hello There' });
    await expect(originalLine.locator('.char-diff--delete', { hasText: 'World' })).toBeVisible();
    await expect(modifiedLine.locator('.char-diff--insert', { hasText: 'There' })).toBeVisible();
    await expect(compareDisplay.locator('.diff-line--insert', { hasText: 'Line 4' })).toBeVisible();

    const editButton = page.locator('#compare-btn');
    await expect(editButton).toHaveText('Edit');
    await editButton.click();

    await expect(page.locator('#original')).toBeVisible();
    await expect(page.locator('#original')).toHaveValue(originalText);
    await expect(page.locator('#modified')).toHaveValue(modifiedText);
  });

  test('highlights complete grapheme clusters for emoji substitutions', async ({ page }) => {
    await page.locator('#original').fill('A👍🏻B');
    await page.locator('#modified').fill('A👍🏽B');
    await page.locator('#compare-btn').click();

    const deletedGrapheme = page.locator('.char-diff--delete');
    const insertedGrapheme = page.locator('.char-diff--insert');
    await expect(deletedGrapheme).toHaveText('👍🏻');
    await expect(insertedGrapheme).toHaveText('👍🏽');
    await expect(page.locator('.char-diff--equal')).toHaveText(['A', 'B', 'A', 'B']);

    expect((await deletedGrapheme.boundingBox())?.width).toBeGreaterThan(0);
    expect((await insertedGrapheme.boundingBox())?.width).toBeGreaterThan(0);
  });

  test('keeps the former final line unchanged when a line is appended', async ({ page }) => {
    await page.locator('#original').fill('a');
    await page.locator('#modified').fill('a\nb');

    await page.locator('#compare-btn').click();

    const rows = page.locator('.compare-display__row');
    await expect(rows).toHaveCount(2);

    const formerFinalLine = rows.first().locator('.diff-line');
    await expect(formerFinalLine.nth(0)).toHaveClass('diff-line');
    await expect(formerFinalLine.nth(1)).toHaveClass('diff-line');
    await expect(formerFinalLine.locator('.diff-line__text')).toHaveText(['a', 'a']);

    const appendedLine = rows.nth(1).locator('.diff-line');
    await expect(appendedLine.nth(0)).toHaveClass(/diff-line--empty/);
    await expect(appendedLine.nth(1)).toHaveClass(/diff-line--insert/);
    await expect(appendedLine.nth(1).locator('.diff-line__text')).toHaveText('b');
  });

  test('keeps inherited prototype names equal on unchanged final lines', async ({ page }) => {
    expect(await page.evaluate(() => Object.isFrozen(Object.prototype))).toBe(true);

    for (const inheritedName of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      await page.locator('#original').fill(['old', inheritedName].join('\n'));
      await page.locator('#modified').fill(['new', inheritedName].join('\n'));
      await page.locator('#compare-btn').click();

      const rows = page.locator('.compare-display__row');
      await expect(rows).toHaveCount(2);

      const changedLines = rows.first().locator('.diff-line');
      await expect(changedLines.nth(0)).toHaveClass(/diff-line--delete/);
      await expect(changedLines.nth(1)).toHaveClass(/diff-line--insert/);

      const unchangedLines = rows.nth(1).locator('.diff-line');
      await expect(unchangedLines.nth(0)).toHaveClass('diff-line');
      await expect(unchangedLines.nth(1)).toHaveClass('diff-line');
      await expect(unchangedLines.locator('.diff-line__text')).toHaveText([inheritedName, inheritedName]);

      await page.locator('#compare-btn').click();
    }
  });

  test('handles empty input gracefully', async ({ page }) => {
    await page.locator('#compare-btn').click();
    await expect(page.getByText('Identical Content')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.locator('#original').fill('Some text');
    await page.locator('#modified').clear();
    await page.locator('#compare-btn').click();

    await expect(page.locator('.compare-display')).toBeVisible();
    await expect(page.locator('.diff-line--delete', { hasText: 'Some text' })).toBeVisible();
  });

  test('shows a trailing-newline row only when the sides differ', async ({ page }) => {
    const trailingNewlineRow = page.locator('.compare-display__row--trailing-newline');

    await test.step('modified text has the only trailing newline', async () => {
      await page.locator('#original').fill('Line 1');
      await page.locator('#modified').fill('Line 1\n');
      await page.locator('#compare-btn').click();

      await expect(trailingNewlineRow).toBeVisible();

      const originalSide = trailingNewlineRow.locator('.compare-display__trailing-newline').first();
      const modifiedSide = trailingNewlineRow.locator('.compare-display__trailing-newline').last();
      await expect(originalSide).toHaveClass(/compare-display__trailing-newline--absent/);
      await expect(originalSide).toContainText('No new line at end of text');
      await expect(modifiedSide).toHaveClass(/compare-display__trailing-newline--present/);
      await expect(modifiedSide).toContainText('New line at end of text');

      await expect(page.locator('.diff-line--delete, .diff-line--insert')).toHaveCount(0);
      await expect(page.locator('.diff-line__text')).toHaveText(['Line 1', 'Line 1']);
    });

    await page.locator('#compare-btn').click();

    await test.step('both texts have trailing newlines', async () => {
      await page.locator('#original').fill('Line 1\nLine 2\n');
      await page.locator('#modified').fill('Line 1\nLine 2 changed\n');
      await page.locator('#compare-btn').click();

      await expect(trailingNewlineRow).toHaveCount(0);
      await expect(page.locator('.compare-display')).toBeVisible();
    });
  });

  test.describe('Collapsing Identical Sections', () => {
    test('collapses unchanged sections at both ends', async ({ page }) => {
      const originalLines = Array.from({ length: 21 }, (_, index) => 'Line ' + (index + 1));
      const modifiedLines = [...originalLines];
      originalLines[10] = 'Line 11 Original';
      modifiedLines[10] = 'Line 11 Modified';

      await page.locator('#original').fill(originalLines.join('\n'));
      await page.locator('#modified').fill(modifiedLines.join('\n'));
      await page.locator('#compare-btn').click();

      const collapsedSections = page.locator('.compare-display__collapsed');
      await expect(collapsedSections).toHaveCount(2);
      await expect(collapsedSections.nth(0)).toContainText('7 unchanged lines hidden');
      await expect(collapsedSections.nth(1)).toContainText('7 unchanged lines hidden');

      await expect(page.getByText('Line 7', { exact: true }).first()).not.toBeVisible();
      await expect(page.getByText('Line 8', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Line 14', { exact: true }).first()).toBeVisible();
      await expect(page.getByText('Line 15', { exact: true }).first()).not.toBeVisible();
    });

    test('collapses multiple regions and toggles one independently', async ({ page }) => {
      const originalLines = Array.from({ length: 31 }, (_, index) => 'Line ' + (index + 1));
      const modifiedLines = [...originalLines];
      for (const lineNumber of [1, 16, 31]) {
        originalLines[lineNumber - 1] = 'Line ' + lineNumber + ' Original';
        modifiedLines[lineNumber - 1] = 'Line ' + lineNumber + ' Modified';
      }

      await page.locator('#original').fill(originalLines.join('\n'));
      await page.locator('#modified').fill(modifiedLines.join('\n'));
      await page.locator('#compare-btn').click();

      const collapsedSections = page.locator('.compare-display__collapsed');
      await expect(collapsedSections).toHaveCount(2);
      await expect(collapsedSections.nth(0)).toContainText('8 unchanged lines hidden');
      await expect(collapsedSections.nth(1)).toContainText('8 unchanged lines hidden');

      const firstRegionLine = page.getByText('Line 8', { exact: true }).first();
      const secondRegionLine = page.getByText('Line 23', { exact: true }).first();
      await expect(firstRegionLine).not.toBeVisible();
      await expect(secondRegionLine).not.toBeVisible();

      await collapsedSections.nth(0).click();

      const expandedSection = page.locator('.compare-display__collapsed--expanded').first();
      await expect(expandedSection).toContainText('Collapse 8 unchanged lines');
      await expect(firstRegionLine).toBeVisible();
      await expect(secondRegionLine).not.toBeVisible();

      await expandedSection.click();

      await expect(firstRegionLine).not.toBeVisible();
      await expect(secondRegionLine).not.toBeVisible();
      await expect(expandedSection).not.toBeVisible();
    });
  });
});
