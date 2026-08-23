import { test, expect } from '@playwright/test';

test('About modal can be opened and closed', async ({ page }) => {
  await page.goto('/');

  // Click the About button in the header
  await page.getByRole('button', { name: 'About' }).click();

  // Check if modal is visible
  const modal = page.locator('.modal__overlay');
  await expect(modal).toBeVisible();

  // Check for the title
  await expect(page.getByRole('heading', { name: 'About TextDiffTool' })).toBeVisible();

  // Check for some content
  await expect(page.getByText('A modern, browser-based tool for comparing text')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Inter license' })).toHaveAttribute(
    'href',
    '/text-diff-tool/fonts/inter/OFL.txt',
  );
  await expect(page.getByRole('link', { name: 'JetBrains Mono license' })).toHaveAttribute(
    'href',
    '/text-diff-tool/fonts/jetbrains-mono/OFL.txt',
  );
  await expect(page.getByRole('link', { name: 'Runtime library licenses and notices' })).toHaveAttribute(
    'href',
    '/text-diff-tool/THIRD_PARTY_NOTICES.txt',
  );

  // Close the modal using the footer button
  await page.locator('.modal__footer').getByRole('button', { name: 'Close' }).click();

  // Check if modal is hidden
  await expect(modal).toBeHidden();
});
