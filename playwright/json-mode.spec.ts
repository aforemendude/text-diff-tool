import { test, expect } from '@playwright/test';

test.describe('JSON Mode Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Toggle is a label containing the checkbox. Click the label to toggle.
    await page.locator('.toggle').click();

    // Verify it is checked
    const jsonModeToggle = page.locator('.toggle input[type="checkbox"]');
    await expect(jsonModeToggle).toBeChecked();
  });

  test('ignores object key order', async ({ page }) => {
    // Two objects with same data but different key order
    const obj1 = {
      name: 'John',
      age: 30,
      city: 'New York',
    };
    const obj2 = {
      city: 'New York',
      name: 'John',
      age: 30,
    };

    const text1 = JSON.stringify(obj1, null, 2);
    const text2 = JSON.stringify(obj2, null, 2);

    await page.locator('#original').fill(text1);
    await page.locator('#modified').fill(text2);

    await page.locator('#compare-btn').click();

    // Should see identical content modal
    await expect(page.getByText('Identical Content')).toBeVisible();
    await expect(
      page.getByText('The original and modified content are exactly the same'),
    ).toBeVisible();
  });

  test('ignores whitespace and formatting differences', async ({ page }) => {
    // Same object, different spacing
    const obj = { name: 'Alice', active: true };
    const text1 = JSON.stringify(obj); // one line, no spaces
    const text2 = JSON.stringify(obj, null, 4); // formatted with 4 spaces

    await page.locator('#original').fill(text1);
    await page.locator('#modified').fill(text2);

    await page.locator('#compare-btn').click();

    await expect(page.getByText('Identical Content')).toBeVisible();
  });

  test('ignores both key order and formatting differences simultaneously', async ({
    page,
  }) => {
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

    // The display should show the formatted JSON
    // We expect formatting to apply (lines 2 spaces indented)
    // And we expect differences to be highlighted
    await expect(compareDisplay).toContainText('"value": 100');
    await expect(compareDisplay).toContainText('"value": 200');
  });

  test('shows error for invalid JSON', async ({ page }) => {
    const validJson = '{"foo": "bar"}';
    const invalidJson = '{"foo": "bar"'; // Missing closing brace

    await page.locator('#original').fill(validJson);
    await page.locator('#modified').fill(invalidJson);

    await page.locator('#compare-btn').click();

    // Should show error modal
    await expect(page.locator('.modal__title')).toContainText(
      'JSON Parse Error',
    );
    await expect(
      page.getByText('Failed to parse the modified text as JSON'),
    ).toBeVisible();
  });
});
