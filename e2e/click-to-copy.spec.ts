import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** The database is 15 MB, so every wait here allows for the download. */
const READY = 60_000;

const ETHANOL_SQL =
  "SELECT preferred_name, formula FROM compounds WHERE preferred_name = 'Ethanol'";

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('the tool text is not selectable, and a double click paints nothing', async ({
  page,
}) => {
  await page.goto('/');
  const columns = page.locator('.table-list__columns').first();
  await expect(columns).toBeVisible({ timeout: READY });

  expect(await userSelectOf(columns)).toBe('none');

  await columns.dblclick();
  expect(
    await page.evaluate(() => window.getSelection()?.toString() ?? ''),
  ).toBe('');
});

test('a result cell copies exactly what it holds', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('SQL query').fill(ETHANOL_SQL);
  await page.getByRole('button', { name: 'Run' }).first().click();

  // Addressed by position: a copied cell carries a `Copied` status, so its
  // accessible name is not the same before and after the click.
  const cells = page.locator('.terminal-table tbody td');
  await expect(cells).toHaveCount(2, { timeout: READY });

  const name = cells.first();
  await expect(name).toHaveText('Ethanol');
  await expect(name).toHaveAttribute(
    'title',
    'Copy the preferred_name (Ethanol)',
  );
  await expect(name).toHaveCSS('cursor', 'copy');
  expect(await copyFrom(page, name)).toBe('Ethanol');

  // A formula cell is drawn by `<MF>`, and copies its plain string.
  const formula = cells.nth(1);
  await expect(formula).toHaveAttribute('title', 'Copy the formula (C2H6O)');
  expect(await copyFrom(page, formula)).toBe('C2H6O');
});

test('the whole result travels as tab-separated values', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('SQL query').fill(ETHANOL_SQL);
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(
    page.getByRole('cell', { name: 'Ethanol', exact: true }),
  ).toBeVisible({ timeout: READY });

  // The button keeps `Copy as TSV` as its accessible name throughout; what
  // changes is the text it reads.
  const tsv = page.getByRole('button', { name: 'Copy as TSV' });
  await tsv.click();
  await expect(tsv).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'preferred_name\tformula\nEthanol\tC2H6O',
  );
});

test('a Mango document stays selectable, because a field is quoted from it', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Mango query')
    .fill('{"selector":{"name":"Ethanol"},"fields":["name","formula"]}');
  await page.getByRole('button', { name: 'Run' }).nth(1).click();

  const document = page.locator('.json-doc').first();
  await expect(document).toContainText('"formula": "C2H6O"', {
    timeout: READY,
  });
  expect(await userSelectOf(document)).toBe('text');
});

test('a failed query leaves its message selectable, to be taken away', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('SQL query').fill('SELECT nme FROM compounds');
  await page.getByRole('button', { name: 'Run' }).first().click();

  const error = page.locator('.terminal__error').first();
  await expect(error).toContainText('no such column', { timeout: READY });
  expect(await userSelectOf(error)).toBe('text');

  await error.dblclick();
  expect(
    await page.evaluate(() => window.getSelection()?.toString().trim() ?? ''),
  ).not.toBe('');
});

test('a compound gives its CAS number, bare, with a click', async ({
  page,
}) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('7-Bromo');
  await page.locator('.browse__entry').first().click({ timeout: READY });
  await expect(page.locator('.detail__name')).toHaveText('7-Bromo-1H-indole');

  const cas = page.locator('.detail__head .click-to-copy').filter({
    hasText: 'CAS 51417-51-7',
  });
  await expect(cas).toHaveCSS('cursor', 'copy');
  // The number is copied without the `CAS ` the tag reads.
  expect(await copyFrom(page, cas)).toBe('51417-51-7');
  // Copying a value never moves the browser off the compound it sits on.
  await expect(page.locator('.detail__name')).toHaveText('7-Bromo-1H-indole');
});

test('a fact of the compound copies the value without its unit', async ({
  page,
}) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('7-Bromo');
  await page.locator('.browse__entry').first().click({ timeout: READY });
  await expect(page.locator('.detail__name')).toHaveText('7-Bromo-1H-indole');

  // The first monospaced fact is the SMILES; the second is the OCL id code.
  const smiles = page
    .locator('.detail__facts dd.is-mono .click-to-copy')
    .first();
  expect(await copyFrom(page, smiles)).toBe('Brc1c2[nH]ccc2ccc1');

  const melting = page
    .locator('.detail__claims .click-to-copy')
    .filter({ hasText: '46–47°C' })
    .first();
  expect(await copyFrom(page, melting)).toBe('46–47');
});

/**
 * Click a value and read back what it put on the clipboard.
 *
 * The tick is waited for rather than the click, because the clipboard is
 * written asynchronously and reading it too early returns the previous value.
 * @param page - The page the value sits on.
 * @param value - The copyable value.
 * @returns What the clipboard holds afterwards.
 */
async function copyFrom(page: Page, value: Locator): Promise<string> {
  await value.click();
  await expect(value).toHaveAttribute('data-copy', 'copied');
  return page.evaluate(() => navigator.clipboard.readText());
}

/**
 * What the browser computes for an element's `user-select`.
 * @param value - The element.
 * @returns `none` or `text`.
 */
function userSelectOf(value: Locator): Promise<string> {
  return value.evaluate(
    (element) => getComputedStyle(element).userSelect || 'none',
  );
}
