import { test, expect } from '@playwright/test';

test.describe('Line Ending Diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('detects when original has trailing newline and modified does not', async ({ page }) => {
    // Original with newline, modified without
    await page.locator('#original').fill('Line 1\n');
    await page.locator('#modified').fill('Line 1');

    await page.locator('#compare-btn').click();

    const diffRow = page.locator('.compare-display__row--trailing-newline');
    await expect(diffRow).toBeVisible();

    // Original side should show "present"
    const originalSide = diffRow.locator('.compare-display__trailing-newline').first();
    await expect(originalSide).toHaveClass(/compare-display__trailing-newline--present/);
    await expect(originalSide).toContainText('New line at end of text');

    // Modified side should show "absent"
    const modifiedSide = diffRow.locator('.compare-display__trailing-newline').last();
    await expect(modifiedSide).toHaveClass(/compare-display__trailing-newline--absent/);
    await expect(modifiedSide).toContainText('No new line at end of text');
  });

  test('detects when modified has trailing newline and original does not', async ({ page }) => {
    // Original without newline, modified with
    await page.locator('#original').fill('Line 1');
    await page.locator('#modified').fill('Line 1\n');

    await page.locator('#compare-btn').click();

    const diffRow = page.locator('.compare-display__row--trailing-newline');
    await expect(diffRow).toBeVisible();

    // Original side should show "absent"
    const originalSide = diffRow.locator('.compare-display__trailing-newline').first();
    await expect(originalSide).toHaveClass(/compare-display__trailing-newline--absent/);
    await expect(originalSide).toContainText('No new line at end of text');

    // Modified side should show "present"
    const modifiedSide = diffRow.locator('.compare-display__trailing-newline').last();
    await expect(modifiedSide).toHaveClass(/compare-display__trailing-newline--present/);
    await expect(modifiedSide).toContainText('New line at end of text');

    // The unchanged content line should not also be styled as a modification.
    await expect(page.locator('.diff-line--delete, .diff-line--insert')).toHaveCount(0);
    await expect(page.locator('.diff-line__text')).toHaveText(['Line 1', 'Line 1']);
  });

  test('does not show trailing newline indicator when both have trailing newline', async ({ page }) => {
    // Both with newline
    await page.locator('#original').fill('Line 1\nLine 2\n');
    // Change something else so they aren't identical
    await page.locator('#modified').fill('Line 1\nLine 2 changed\n');

    await page.locator('#compare-btn').click();

    const diffRow = page.locator('.compare-display__row--trailing-newline');
    await expect(diffRow).not.toBeVisible();
  });

  test('does not show trailing newline indicator when neither has trailing newline', async ({ page }) => {
    // Neither with newline
    await page.locator('#original').fill('Line 1\nLine 2');
    await page.locator('#modified').fill('Line 1\nLine 2 changed');

    await page.locator('#compare-btn').click();

    const diffRow = page.locator('.compare-display__row--trailing-newline');
    await expect(diffRow).not.toBeVisible();
  });
});
