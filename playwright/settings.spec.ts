import { test, expect } from '@playwright/test';

test.describe('Settings and Diff Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('uses no cleanup by default and can apply semantic cleanup to the same diff', async ({ page }) => {
    const original = 'The quick brown fox';
    const modified = 'The brown quick fox';

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);

    await page.locator('#compare-btn').click();

    await test.step('no cleanup preserves the common text between the edits', async () => {
      const originalLine = page.locator('.diff-line--delete');
      const modifiedLine = page.locator('.diff-line--insert');

      await expect(originalLine.locator('.char-diff--delete')).toHaveText('quick ');
      await expect(modifiedLine.locator('.char-diff--insert')).toHaveText(' quick');
    });

    await page.locator('#compare-btn').click();
    await page.locator('#settings-btn').click();
    await page.getByText('Semantic Cleanup', { exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('#compare-btn').click();

    await test.step('semantic cleanup treats the reordered phrase as a word replacement', async () => {
      const originalLine = page.locator('.diff-line--delete');
      const modifiedLine = page.locator('.diff-line--insert');

      await expect(originalLine.locator('.char-diff--delete')).toHaveText('quick brown');
      await expect(modifiedLine.locator('.char-diff--insert')).toHaveText('brown quick');
    });
  });

  test('labels every default, omits Sparse, and applies whole-content grapheme diffing with Adaptive', async ({
    page,
  }) => {
    await page.locator('#settings-btn').click();

    const dialog = page.getByRole('dialog', { name: 'Diff settings' });
    await expect(dialog.locator('.settings-modal__default-badge')).toHaveText(['Default', 'Default', 'Default']);
    await expect(dialog.locator('input[value="line-grapheme"]')).toBeChecked();
    await expect(dialog.locator('input[value="myers"]')).toBeChecked();
    await expect(dialog.locator('input[value="none"]')).toBeChecked();
    await expect(dialog.getByText('Sparse', { exact: true })).toHaveCount(0);

    await dialog.getByText('Just grapheme', { exact: true }).click();
    await dialog.getByText('Adaptive', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.locator('#original').fill('The quick brown fox\njumps over the lazy dog');
    await page.locator('#modified').fill('The quick brown\nfox jumps over the lazy dog');
    await page.locator('#compare-btn').click();

    const rows = page.locator('.compare-display__row');
    await expect(rows).toHaveCount(2);
    await expect(rows.locator('.diff-line__number')).toHaveText(['1', '1', '2', '2']);
    await expect(rows.first().locator('.diff-line').first().locator('.char-diff--delete')).toHaveText(' ');
    await expect(rows.nth(1).locator('.diff-line').last().locator('.char-diff--insert')).toHaveText(' ');
  });

  test('enables and applies edit cost for efficiency cleanup', async ({ page }) => {
    // A single character 'a' between two edits. Raw diff: -c, +m, a, -t, +p
    const original = 'cat';
    const modified = 'map';

    await page.locator('#settings-btn').click();
    await expect(page.locator('#edit-cost')).toBeDisabled();
    await page.getByText('Efficiency Cleanup', { exact: true }).click();
    await expect(page.locator('#edit-cost')).toBeEnabled();
    await page.locator('#edit-cost').fill('1');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);
    await page.locator('#compare-btn').click();

    // With a low cost, it should preserve the 'a' in the middle as equal.
    await expect(page.locator('.char-diff--equal').first()).toHaveText('a');

    await page.locator('#compare-btn').click(); // Back to edit
    await page.locator('#settings-btn').click();
    await page.locator('#edit-cost').fill('4');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.locator('#compare-btn').click();

    // With cost 4, 'a' (1 char) is less than cost, so it should be merged into the edits. The entire line should be a
    // modification without any equal char diffs.
    await expect(page.locator('.char-diff--equal')).not.toBeVisible();
    await expect(page.locator('.char-diff--delete').first()).toHaveText('cat');
    await expect(page.locator('.char-diff--insert').first()).toHaveText('map');
  });
});
