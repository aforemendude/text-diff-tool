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
  test.describe('Collapsing Identical Sections', () => {
    test('collapses lines at the beginning', async ({ page }) => {
      // Create 15 lines. First 10 identical, line 11 changed.
      // Context is 3. So lines 1..7 (index 0..6) should be hidden.
      // Index 10 is changed. Visible: 7,8,9,10.
      // 0..6 are hidden. Count = 7.
      const common = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`).join(
        '\n',
      );
      const original = `${common}\nLine 11 Original`;
      const modified = `${common}\nLine 11 Modified`;

      await page.locator('#original').fill(original);
      await page.locator('#modified').fill(modified);
      await page.locator('#compare-btn').click();

      // Expect collapse at start
      const collapseHeader = page.locator('.diff-collapsed').first();
      await expect(collapseHeader).toBeVisible();
      await expect(collapseHeader).toContainText('7 unchanged lines hidden');

      // Verify expansion
      await collapseHeader.click();
      await expect(page.getByText('Line 1').first()).toBeVisible();
      // Should show expansion header "Collapse 7 unchanged lines"
      await expect(page.locator('.diff-collapsed--expanded')).toContainText(
        'Collapse 7 unchanged lines',
      );
    });

    test('collapses lines at the end', async ({ page }) => {
      // Line 1 changed. 10 lines identical after.
      // Line 1 (index 0) changed. Visible 0..3 (Lines 1..4).
      // Hidden: Lines 5..11 (Indices 4..10). Total 7.
      const common = Array.from({ length: 10 }, (_, i) => `Line ${i + 2}`).join(
        '\n',
      );
      const original = `Line 1 Original\n${common}`;
      const modified = `Line 1 Modified\n${common}`;

      await page.locator('#original').fill(original);
      await page.locator('#modified').fill(modified);
      await page.locator('#compare-btn').click();

      const collapseFooter = page.locator('.diff-collapsed').last();
      await expect(collapseFooter).toBeVisible();
      await expect(collapseFooter).toContainText('7 unchanged lines hidden');
    });

    test('collapses lines in the middle', async ({ page }) => {
      // Line 1 changed. 14 lines identical. Line 16 changed.
      // Index 0 changed -> Keep 0..3 (Lines 1..4)
      // Index 15 changed -> Keep 12..15 (Lines 13..16)
      // Hide Lines 5..12.
      // 12 - 5 + 1 = 8 lines.

      const prefix = 'Line 1 Original\n';
      const prefixMod = 'Line 1 Modified\n';
      const suffix = '\nLine 16 Original';
      const suffixMod = '\nLine 16 Modified';
      const middle = Array.from({ length: 14 }, (_, i) => `Line ${i + 2}`).join(
        '\n',
      );

      await page.locator('#original').fill(prefix + middle + suffix);
      await page.locator('#modified').fill(prefixMod + middle + suffixMod);
      await page.locator('#compare-btn').click();

      const collapseMiddle = page.locator('.diff-collapsed');
      await expect(collapseMiddle).toBeVisible();
      await expect(collapseMiddle).toContainText('8 unchanged lines hidden');

      // Verify visible lines around it
      await expect(page.getByText('Line 4').first()).toBeVisible(); // Last visible top
      await expect(page.getByText('Line 13').first()).toBeVisible(); // First visible bottom
      await expect(page.getByText('Line 5').first()).not.toBeVisible(); // Hidden
      await expect(page.getByText('Line 12').first()).not.toBeVisible(); // Hidden
    });

    test('collapses multiple regions', async ({ page }) => {
      // Structure:
      // Change (L1)
      // Gap 1 (8 lines hidden) -> Needs 8+6 = 14 lines.
      // Change (L16)
      // Gap 2 (8 lines hidden) -> Needs 14 lines.
      // Change (L31)

      // L1 changed. Vis 1..4.
      // L16 changed. Vis 13..16 and 16..19. (Union 13..19)
      // Gap: 5..12 (8 lines).
      // L31 changed. Vis 28..31.
      // Gap: 20..27 (8 lines).

      // Total lines: 31.

      const lines: string[] = [];
      for (let i = 1; i <= 31; i++) {
        lines.push(`Line ${i}`);
      }

      const originalLines = [...lines];
      const modifiedLines = [...lines];

      // Modify L1, L16, L31
      originalLines[0] = 'Line 1 Original';
      modifiedLines[0] = 'Line 1 Modified';
      originalLines[15] = 'Line 16 Original';
      modifiedLines[15] = 'Line 16 Modified';
      originalLines[30] = 'Line 31 Original';
      modifiedLines[30] = 'Line 31 Modified';

      await page.locator('#original').fill(originalLines.join('\n'));
      await page.locator('#modified').fill(modifiedLines.join('\n'));
      await page.locator('#compare-btn').click();

      // Should find 2 collapse sections
      await expect(page.locator('.diff-collapsed')).toHaveCount(2);
      await expect(page.locator('.diff-collapsed').nth(0)).toContainText(
        '8 unchanged lines hidden',
      );
      await expect(page.locator('.diff-collapsed').nth(1)).toContainText(
        '8 unchanged lines hidden',
      );
    });

    test('toggles collapse state (expand and re-collapse)', async ({
      page,
    }) => {
      // Setup a scenario with a large middle section to hide
      // 20 lines total. L1 and L20 changed.
      // Context 3 lines around changes.
      // Hidden: Lines 5..16 (12 lines).

      // Create a middle section with a unique line to test visibility
      const middleLines = Array.from({ length: 18 }, (_, i) =>
        i === 8 ? 'Unique Hidden Line' : `Line ${i + 2}`,
      );
      const middle = middleLines.join('\n');

      const original = `Line 1 Original\n${middle}\nLine 20 Original`;
      const modified = `Line 1 Modified\n${middle}\nLine 20 Modified`;

      await page.locator('#original').fill(original);
      await page.locator('#modified').fill(modified);
      await page.locator('#compare-btn').click();

      // Use .first() to be precise, though there's only one here
      const collapseSection = page.locator('.diff-collapsed').first();

      // 1. Verify Initial State: Collapsed
      await expect(collapseSection).toBeVisible();
      await expect(collapseSection).toContainText('12 unchanged lines hidden');

      // Verify our unique line is hidden
      // Using .first() in case it exists in DOM but hidden
      const hiddenLine = page.getByText('Unique Hidden Line').first();
      await expect(hiddenLine).not.toBeVisible();

      // 2. Click to Expand
      await collapseSection.click();

      // 3. Verify Expanded State
      // Unique line should now be visible
      await expect(hiddenLine).toBeVisible();

      // Expanded header should be visible
      const expandedHeader = page.locator('.diff-collapsed--expanded').first();
      await expect(expandedHeader).toBeVisible();
      await expect(expandedHeader).toContainText('Collapse 12 unchanged lines');

      // 4. Click to Re-collapse
      await expandedHeader.click();

      // 5. Verify Back to Collapsed State
      await expect(hiddenLine).not.toBeVisible();
      await expect(collapseSection).toBeVisible();
      await expect(expandedHeader).not.toBeVisible();
    });
  });
});
