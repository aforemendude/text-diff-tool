import { test, expect } from '@playwright/test';

test.describe('JSON Mode Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Toggle is a label containing the checkbox. Click the label to toggle.
    await page.locator('.header__toggle').click();

    // Verify it is checked
    const jsonModeToggle = page.locator('.header__toggle input[type="checkbox"]');
    await expect(jsonModeToggle).toBeChecked();
  });

  test('ignores both key order and formatting differences', async ({ page }) => {
    const text1 = '{"name": "Bob", "id": 123}';
    const text2 = `{
      "id": 123,
      "name": "Bob"
    }`;

    await page.locator('#original').fill(text1);
    await page.locator('#modified').fill(text2);

    await page.locator('#compare-btn').click();

    await expect(page.getByText('Identical Content')).toBeVisible();
  });

  test('detects actual value differences', async ({ page }) => {
    const text1 = '{"value": 100}';
    const text2 = '{"value": 200}';

    await page.locator('#original').fill(text1);
    await page.locator('#modified').fill(text2);

    await page.locator('#compare-btn').click();

    // Should enter compare mode
    const compareDisplay = page.locator('.compare-display');
    await expect(compareDisplay).toBeVisible();

    // The display should show the formatted JSON We expect formatting to apply (lines 2 spaces indented) And we expect
    // differences to be highlighted
    await expect(compareDisplay).toContainText('"value": 100');
    await expect(compareDisplay).toContainText('"value": 200');
  });

  test('warns once with counts for precision and duplicate-key issues, then continues the diff', async ({ page }) => {
    await page.locator('#original').fill('{"large":9007199254740993,"same":1,"same":2}');
    await page.locator('#modified').fill('{"large":9007199254740995,"same":1,"same":3}');

    await page.locator('#compare-btn').click();

    const warningModal = page.locator('.modal');
    await expect(warningModal.getByText('JSON Parse Warning - 4 Issues')).toBeVisible();
    await expect(warningModal.locator('.modal__message')).toHaveText(
      [
        'Both texts contain valid JSON, but parsing them may change some of their contents.',
        '',
        'Original Text',
        '',
        '• 1 number may change — the parsed value may be rounded or converted to null.',
        '• 1 duplicate key — only the last value for that key will be kept.',
        '',
        'Modified Text',
        '',
        '• 1 number may change — the parsed value may be rounded or converted to null.',
        '• 1 duplicate key — only the last value for that key will be kept.',
        '',
        'Close this warning to continue the comparison with the parsed values.',
      ].join('\n'),
    );
    await expect(page.locator('.compare-display')).not.toBeVisible();

    await warningModal.getByRole('button', { name: 'Continue' }).click();

    const compareDisplay = page.locator('.compare-display');
    await expect(compareDisplay).toBeVisible();
    await expect(compareDisplay).toContainText('"same": 2');
    await expect(compareDisplay).toContainText('"same": 3');
  });

  test('shows error for invalid JSON', async ({ page }) => {
    const validJson = '{"id": 9007199254740993, "id": 1}';
    const invalidJson = '{"foo": "bar"'; // Missing closing brace

    await page.locator('#original').fill(validJson);
    await page.locator('#modified').fill(invalidJson);

    await page.locator('#compare-btn').click();

    // Should show error modal
    await expect(page.locator('.modal__title')).toContainText('JSON Parse Error');
    await expect(page.getByText('Failed to parse the modified text as JSON')).toBeVisible();
    await expect(page.getByText(/JSON Parse Warning/)).not.toBeVisible();
  });

  test('preserves array element order', async ({ page }) => {
    // Same objects, but swapped in the array
    const text1 = `[
      {"id": 1},
      {"id": 2}
    ]`;
    const text2 = `[
      {"id": 2},
      {"id": 1}
    ]`;

    await page.locator('#original').fill(text1);
    await page.locator('#modified').fill(text2);
    await page.locator('#compare-btn').click();

    // Should NOT show identical modal, should show compare display
    await expect(page.locator('.compare-display')).toBeVisible();
    await expect(page.locator('.modal')).not.toBeVisible();
  });
});
