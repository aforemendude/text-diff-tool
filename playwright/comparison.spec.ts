import { expect, test } from '@playwright/test';

test.describe('Comparison workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('compares text and returns to editing', async ({ page }) => {
    const originalText = 'Line 1\nHello World\nLine 3';
    const modifiedText = 'Line 1\nHello There\nLine 3\nLine 4';

    await page.getByRole('textbox', { name: 'Original', exact: true }).fill(originalText);
    await page.getByRole('textbox', { name: 'Modified', exact: true }).fill(modifiedText);
    await page.getByRole('button', { name: 'Compare', exact: true }).click();

    const comparison = page.getByRole('table', { name: 'Original and modified text comparison' });
    await expect(comparison).toBeVisible();
    await expect(comparison.getByRole('deletion')).toHaveText(['Wo', 'ld']);
    await expect(comparison.getByRole('insertion')).toHaveText(['The', 'e']);
    await expect(comparison.locator('.diff-line--insert', { hasText: 'Line 4' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit', exact: true }).click();

    await expect(page.getByRole('textbox', { name: 'Original', exact: true })).toHaveValue(originalText);
    await expect(page.getByRole('textbox', { name: 'Modified', exact: true })).toHaveValue(modifiedText);
  });

  test('normalizes equivalent JSON through the complete UI workflow', async ({ page }) => {
    const jsonMode = page.getByRole('checkbox', { name: 'JSON Mode' });
    await page.getByText('JSON Mode', { exact: true }).click();
    await expect(jsonMode).toBeChecked();
    await page.getByRole('textbox', { name: 'Original', exact: true }).fill('{"name": "Bob", "id": 123}');
    await page.getByRole('textbox', { name: 'Modified', exact: true }).fill(`{
      "id": 123,
      "name": "Bob"
    }`);

    await page.getByRole('button', { name: 'Compare', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Identical Content' })).toBeVisible();
  });

  test('lets users disable character-level text decorations', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Original', exact: true }).fill('abc');
    await page.getByRole('textbox', { name: 'Modified', exact: true }).fill('axc');
    await page.getByRole('button', { name: 'Compare', exact: true }).click();

    const deletion = page.getByRole('deletion');
    const insertion = page.getByRole('insertion');
    await expect(deletion).toHaveCSS('text-decoration-line', 'line-through');
    await expect(insertion).toHaveCSS('text-decoration-line', 'underline');
    await expect(insertion).toHaveCSS('text-decoration-style', 'double');

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Diff settings' });
    const colorOnly = dialog.getByRole('radio', { name: /Color highlights only/ });
    await dialog.getByText('Color highlights only', { exact: true }).click();
    await expect(colorOnly).toBeChecked();
    await dialog.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(page.getByRole('deletion')).toHaveCSS('text-decoration-line', 'none');
    await expect(page.getByRole('insertion')).toHaveCSS('text-decoration-line', 'none');
  });
});
