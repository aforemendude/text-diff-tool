import { test, expect } from '@playwright/test';

test('About modal can be opened and closed', async ({ page }) => {
  await page.goto('/');

  // Click the About button in the header
  await page.getByRole('button', { name: 'About' }).click();

  // Check if modal is visible
  const modal = page.locator('.modal-overlay');
  await expect(modal).toBeVisible();

  // Check for the title
  await expect(
    page.getByRole('heading', { name: 'About TextDiffTool' }),
  ).toBeVisible();

  // Check for some content
  await expect(
    page.getByText('A modern, browser-based tool for comparing text'),
  ).toBeVisible();

  // Close the modal using the footer button
  await page
    .locator('.modal__footer')
    .getByRole('button', { name: 'Close' })
    .click();

  // Check if modal is hidden
  await expect(modal).toBeHidden();
});
