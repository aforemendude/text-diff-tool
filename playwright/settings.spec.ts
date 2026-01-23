import { test, expect } from '@playwright/test';

test.describe('Settings and Diff Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens and closes the settings modal', async ({ page }) => {
    // Open settings
    await page.locator('#settings-btn').click();
    await expect(page.locator('.settings-modal')).toBeVisible();
    await expect(page.getByText('Diff Cleanup Mode')).toBeVisible();

    // Close settings via Done button
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('.settings-modal')).not.toBeVisible();

    // Open again
    await page.locator('#settings-btn').click();
    await expect(page.locator('.settings-modal')).toBeVisible();

    // Close via '×' button
    await page.locator('.modal__close').click();
    await expect(page.locator('.settings-modal')).not.toBeVisible();
  });

  test('enables/disables edit cost based on cleanup mode', async ({ page }) => {
    await page.locator('#settings-btn').click();

    // Default is Semantic Cleanup
    await expect(page.locator('#edit-cost')).toBeDisabled();

    // Switch to Efficiency Cleanup
    await page.getByText('Efficiency Cleanup', { exact: true }).click();
    await expect(page.locator('#edit-cost')).toBeEnabled();

    // Switch to No Cleanup
    await page.getByText('No Cleanup', { exact: true }).click();
    await expect(page.locator('#edit-cost')).toBeDisabled();
  });

  test('applies semantic cleanup to diffs', async ({ page }) => {
    // Semantic cleanup should merge short edits and align to word boundaries
    const original = 'The quick brown fox';
    const modified = 'The brown quick fox';

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);

    // Settings are semantic by default
    await page.locator('#compare-btn').click();

    // With semantic cleanup, "quick" vs "fast" should be treated as a word replacement
    const originalLine = page.locator('.diff-line--modify-delete');
    const modifiedLine = page.locator('.diff-line--modify-insert');

    await expect(originalLine.locator('.char-diff--delete')).toHaveText(
      'quick brown',
    );
    await expect(modifiedLine.locator('.char-diff--insert')).toHaveText(
      'brown quick',
    );
  });

  test('applies no cleanup for raw diff results', async ({ page }) => {
    const original = 'The quick brown fox';
    const modified = 'The brown quick fox';

    // Set to No Cleanup
    await page.locator('#settings-btn').click();
    await page.getByText('No Cleanup', { exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);
    await page.locator('#compare-btn').click();

    // "apple" -> "apply"
    // Raw diff: "appl" (equal), "e" (delete), "y" (insert)
    const originalLine = page.locator('.diff-line--modify-delete');
    const modifiedLine = page.locator('.diff-line--modify-insert');

    await expect(originalLine.locator('.char-diff--delete')).toHaveText(
      'quick ',
    );
    await expect(modifiedLine.locator('.char-diff--insert')).toHaveText(
      ' quick',
    );
  });

  test('edit cost affects efficiency cleanup', async ({ page }) => {
    // A single character 'a' between two edits.
    // Raw diff: -c, +m, a, -t, +p
    const original = 'cat';
    const modified = 'map';

    // 1. Efficiency with cost 1 (minimal merging)
    await page.locator('#settings-btn').click();
    await page.getByText('Efficiency Cleanup', { exact: true }).click();
    await page.locator('#edit-cost').fill('1');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);
    await page.locator('#compare-btn').click();

    // With cost 0, it should preserve the 'a' in the middle as equal
    await expect(page.locator('.char-diff--equal').first()).toHaveText('a');

    // 2. Efficiency with high cost (4)
    await page.locator('#compare-btn').click(); // Back to edit
    await page.locator('#settings-btn').click();
    await page.locator('#edit-cost').fill('4');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.locator('#compare-btn').click();

    // With cost 4, 'a' (1 char) is less than cost, so it should be merged into the edits.
    // The entire line should be a modification without any equal char diffs.
    await expect(page.locator('.char-diff--equal')).not.toBeVisible();
    await expect(page.locator('.char-diff--delete').first()).toHaveText('cat');
    await expect(page.locator('.char-diff--insert').first()).toHaveText('map');
  });
});
