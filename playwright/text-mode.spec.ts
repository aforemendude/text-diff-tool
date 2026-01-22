import { test, expect } from '@playwright/test';

test.describe('Text Mode Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // ensure we start in text mode (JSON mode off) - checking initial state
    const jsonModeToggle = page.locator('.toggle input[type="checkbox"]');
    await expect(jsonModeToggle).not.toBeChecked();
  });

  test('performs basic text matching', async ({ page }) => {
    const originalText = 'The quick brown fox jumps over the lazy dog.';
    const modifiedText = 'The quick brown fox jumps over the lazy dog.';

    // Fill in text
    await page.locator('#original').fill(originalText);
    await page.locator('#modified').fill(modifiedText);

    // Click Compare
    await page.locator('#compare-btn').click();

    // Should see identical content modal, not result view
    await expect(page.getByText('Identical Content')).toBeVisible();
    await expect(
      page.getByText('The original and modified content are exactly the same'),
    ).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('detects insertions and deletions', async ({ page }) => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const modifiedText = 'Line 1\nLine 2 changed\nLine 3\nLine 4';

    await page.locator('#original').fill(originalText);
    await page.locator('#modified').fill(modifiedText);

    await page.locator('#compare-btn').click();

    // Check we entered compare mode
    const compareDisplay = page.locator('.compare-display');
    await expect(compareDisplay).toBeVisible();

    // Verify content
    // Line 2 modified: "Line 2" -> "Line 2 changed"
    // Since it's a modification, we expect the original to show delete and modified insert
    // But implementation details might vary (whole line replacement vs partial).
    // Based on App.tsx it seems to try char diff if lines are similar.

    // Let's verify we see the texts
    await expect(compareDisplay).toContainText('Line 1');
    await expect(compareDisplay).toContainText('Line 2 changed');
    await expect(compareDisplay).toContainText('Line 3');
    await expect(compareDisplay).toContainText('Line 4');

    // Specific class checks can be fragile if implementation changes, but let's try broadly
    // Line 4 is an insertion
    const addedLine = compareDisplay.locator('.diff-line--insert', {
      hasText: 'Line 4',
    });
    await expect(addedLine).toBeVisible();
  });

  test('handles empty input gracefully', async ({ page }) => {
    // Both empty
    await page.locator('#compare-btn').click();
    // Should be treated as identical
    await expect(page.getByText('Identical Content')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    // One empty
    await page.locator('#original').fill('Some text');
    await page.locator('#modified').clear();
    await page.locator('#compare-btn').click();

    await expect(page.locator('.compare-display')).toBeVisible();
    // Should see deletion of "Some text"
    await expect(
      page.locator('.diff-line--delete', { hasText: 'Some text' }),
    ).toBeVisible();
  });

  test('allows switching back to edit mode', async ({ page }) => {
    await page.locator('#original').fill('foo');
    await page.locator('#modified').fill('bar');
    await page.locator('#compare-btn').click();

    await expect(page.locator('.compare-display')).toBeVisible();

    // Button should now say Edit
    const editBtn = page.locator('#compare-btn');
    await expect(editBtn).toHaveText('Edit');

    await editBtn.click();

    // Should return to inputs
    await expect(page.locator('#original')).toBeVisible();
    await expect(page.locator('#original')).toHaveValue('foo');
    await expect(page.locator('#modified')).toHaveValue('bar');
  });

  test('highlights character differences', async ({ page }) => {
    await page.locator('#original').fill('Hello World');
    await page.locator('#modified').fill('Hello There');

    await page.locator('#compare-btn').click();

    // "World" -> "There"
    // Expect both lines to show, with char diff highlighting
    const originalLine = page
      .locator('.diff-line--modify-delete')
      .filter({ hasText: 'Hello World' });
    const modifiedLine = page
      .locator('.diff-line--modify-insert')
      .filter({ hasText: 'Hello There' });

    await expect(originalLine).toBeVisible();
    await expect(modifiedLine).toBeVisible();

    // Check specific char highlighting logic if possible, e.g. .char-diff--delete
    await expect(
      originalLine.locator('.char-diff--delete', { hasText: 'World' }),
    ).toBeVisible();
    await expect(
      modifiedLine.locator('.char-diff--insert', { hasText: 'There' }),
    ).toBeVisible();
  });
});
