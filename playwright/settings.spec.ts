import { test, expect } from '@playwright/test';

test.describe('Settings and Diff Modes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('applies semantic and no cleanup modes to the same diff', async ({ page }) => {
    const original = 'The quick brown fox';
    const modified = 'The brown quick fox';

    await page.locator('#original').fill(original);
    await page.locator('#modified').fill(modified);

    await page.locator('#compare-btn').click();

    await test.step('semantic cleanup treats the reordered phrase as a word replacement', async () => {
      const originalLine = page.locator('.diff-line--delete');
      const modifiedLine = page.locator('.diff-line--insert');

      await expect(originalLine.locator('.char-diff--delete')).toHaveText('quick brown');
      await expect(modifiedLine.locator('.char-diff--insert')).toHaveText('brown quick');
    });

    await page.locator('#compare-btn').click();
    await page.locator('#settings-btn').click();
    await page.getByText('No Cleanup', { exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.locator('#compare-btn').click();

    await test.step('no cleanup preserves the common text between the edits', async () => {
      const originalLine = page.locator('.diff-line--delete');
      const modifiedLine = page.locator('.diff-line--insert');

      await expect(originalLine.locator('.char-diff--delete')).toHaveText('quick ');
      await expect(modifiedLine.locator('.char-diff--insert')).toHaveText(' quick');
    });
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
