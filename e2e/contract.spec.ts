/**
 * What every site of the family promises: each address it declares loads
 * cleanly, `/about` is the family's About page under the family's footer, a
 * framed link drops the chrome and keeps the tool working, and an address the
 * site does not know still lands somewhere usable.
 *
 * The addresses and the works to cite are read from the site's own records, so
 * a step or an exercise added to `src/data/` or a paper added to `src/about.ts`
 * is covered without touching this file.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { ABOUT } from '../src/about.ts';
import { INDEXED_ROUTES } from '../src/indexedRoutes.ts';

/** The database is 15 MB, so every wait on a query allows for the download. */
const READY = 60_000;

/**
 * The works `/about` asks to be cited. The page leaves the section out when
 * there are none, so an empty record still fails on the missing heading.
 */
const CITED_WORKS = ABOUT.cite ?? [];

for (const route of INDEXED_ROUTES) {
  test(`${route.path} loads with no page error and no console error`, async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto(route.path);

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(errors).toStrictEqual([]);
  });
}

test('/about is the About page, with its citations and the footer', async ({
  page,
}) => {
  await page.goto('/about');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'database.cheminfo',
  );
  const cite = page.locator('.about-cite');
  await expect(
    cite.getByRole('heading', { name: 'How to cite', exact: true }),
  ).toBeVisible();
  const citations = cite.locator('.about-citation');
  await expect(citations).toHaveCount(CITED_WORKS.length);
  for (const [index, work] of CITED_WORKS.entries()) {
    await expect(
      citations
        .nth(index)
        .getByRole('button', { name: `Cite ${work.what}`, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await expect(
    page.getByRole('contentinfo').getByRole('heading', {
      name: 'The rest of the cheminfo family',
      exact: true,
    }),
  ).toBeVisible();
});

for (const query of ['?embed', '?embed=1']) {
  test(`${query} drops the header and the footer, and SQL still answers`, async ({
    page,
  }) => {
    const errors = collectErrors(page);

    await page.goto(`/${query}`);

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    await page
      .getByLabel('SQL query')
      .fill(
        "SELECT preferred_name, formula FROM compounds WHERE preferred_name = 'Ethanol'",
      );
    await page
      .getByRole('button', { name: 'Run', exact: true })
      .first()
      .click();

    await expect(page.locator('.result__summary').first()).toHaveText(
      /^1 row · [\d.]+ ms$/,
      { timeout: READY },
    );
    await expect(
      page.getByRole('cell', { name: 'Ethanol', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'C2H6O', exact: true }),
    ).toBeVisible();
    expect(errors).toStrictEqual([]);
  });
}

test('?hide=mango drops the Mango editor and keeps the SQL one', async ({
  page,
}) => {
  await page.goto('/?hide=mango');

  await expect(
    page.getByRole('heading', { name: 'SQL', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('SQL query')).toHaveCount(1);
  await expect(page.getByLabel('Mango query')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Mango', exact: true }),
  ).toHaveCount(0);
});

test('an unknown nested address falls back to the playground', async ({
  page,
}) => {
  const errors = collectErrors(page);

  await page.goto('/no/such/page');

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByTestId('page-playground')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'SQL', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(1);
  await page.waitForLoadState('networkidle');
  expect(errors).toStrictEqual([]);
});

/**
 * Record every uncaught exception and every `console.error` the page raises.
 * @param page - The page under test, before it navigates.
 * @returns The messages, filled in as they happen.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}
