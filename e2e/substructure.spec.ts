import { expect, test } from '@playwright/test';

test('a drawn fragment lights its index bits, and the search screens before it compares', async ({
  page,
}) => {
  await page.goto('/substructure');

  await expect(page.locator('.index-grid__cell--on')).toHaveCount(3);

  const funnel = page.locator('.substructure__funnel');

  await expect(funnel).toContainText('215', { timeout: 60_000 });
  await expect(funnel).toContainText('188');

  await page.getByRole('button', { name: 'Bromine', exact: true }).click();

  await expect(funnel).toContainText('39');
  await expect(funnel).toContainText('30');
  await expect(page).toHaveURL(/structure=/);
});

test('picking a key fragment selects its bit in the grid', async ({ page }) => {
  await page.goto('/substructure');
  await page.locator('.index-fragments__item').first().click();

  await expect(page.locator('.index-grid__cell--selected')).toHaveCount(1);
  await expect(page.locator('.substructure__figure figcaption')).toContainText(
    'Bit 7',
  );
});
