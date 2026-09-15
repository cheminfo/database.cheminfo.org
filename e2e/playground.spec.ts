import { expect, test } from '@playwright/test';

/** The database is 15 MB, so every wait here allows for the download. */
const READY = 60_000;

test('the SQL editor answers a real question', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'SQL', exact: true }),
  ).toBeVisible();

  const editor = page.getByLabel('SQL query');
  await editor.fill(
    "SELECT preferred_name, formula FROM compounds WHERE preferred_name = 'Ethanol'",
  );
  await page.getByRole('button', { name: 'Run' }).first().click();

  await expect(
    page.getByRole('cell', { name: 'Ethanol', exact: true }),
  ).toBeVisible({
    timeout: READY,
  });
  await expect(
    page.getByRole('cell', { name: 'C2H6O', exact: true }),
  ).toBeVisible();
});

test('a compound has several boiling points, each at its own pressure', async ({
  page,
}) => {
  await page.goto('/');
  const editor = page.getByLabel('SQL query');
  await editor.fill(
    `SELECT b.low_c, b.pressure_mmhg FROM boiling_points b
     JOIN catalog_entries e ON e.id = b.catalog_entry_id
     JOIN compounds c ON c.id = e.compound_id
     WHERE c.preferred_name = '1,2-Diaminocyclohexane' ORDER BY b.pressure_mmhg DESC`,
  );
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(page.locator('.result__summary').first()).toContainText(
    '3 rows',
    {
      timeout: READY,
    },
  );
  await expect(
    page.getByRole('cell', { name: '760', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '15', exact: true }),
  ).toBeVisible();
});

test('a write is refused, and says why', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('SQL query').fill('DELETE FROM compounds');
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(page.locator('.result__error')).toContainText('read-only', {
    timeout: READY,
  });

  // And the data is still there afterwards.
  await page.getByLabel('SQL query').fill('SELECT COUNT(*) FROM compounds');
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(
    page.getByRole('cell', { name: '541', exact: true }),
  ).toBeVisible();
});

test('the Mango editor answers the same question in its own shape', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Mango query')
    .fill('{"selector":{"name":"Ethanol"},"fields":["name","formula"]}');
  await page.getByRole('button', { name: 'Run' }).nth(1).click();
  await expect(page.locator('.json-doc').first()).toContainText(
    '"formula": "C2H6O"',
    {
      timeout: READY,
    },
  );
});

test('a query travels in the address', async ({ page }) => {
  await page.goto('/?sql=SELECT%20COUNT(*)%20AS%20n%20FROM%20names');
  await expect(page.getByLabel('SQL query')).toHaveValue(
    'SELECT COUNT(*) AS n FROM names',
  );
  await page.getByRole('button', { name: 'Run' }).first().click();
  await expect(
    page.getByRole('cell', { name: '2033', exact: true }),
  ).toBeVisible({
    timeout: READY,
  });
});

test('an embedded page carries no chrome', async ({ page }) => {
  await page.goto('/?embed=1');
  await expect(page.locator('.app-header')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'SQL', exact: true }),
  ).toBeVisible();
});

test('every routed address is served with its own title', async ({ page }) => {
  for (const [path, title] of [
    ['/', 'SQL and Mango playground'],
    ['/tutorial', 'Querying chemistry step by step'],
    ['/exercises', 'Query exercises with test cases'],
    ['/schema', 'The tables and their keys'],
    ['/cheatsheet', 'SQL and Mango, side by side'],
    ['/about', 'About'],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page).toHaveTitle(
      new RegExp(title.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  }
});

test('a tutorial step loads both editors and opens the playground', async ({
  page,
}) => {
  await page.goto('/tutorial');
  await page.getByRole('button', { name: /^Step 7:/ }).click();
  await expect(page.locator('.tutorial__step-title')).toContainText('7.');
  await page.getByRole('button', { name: 'Open in the playground' }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
  await expect(page.getByLabel('SQL query')).toContainText('boiling_points');
});

test('an exercise checks the answer as it is typed', async ({ page }) => {
  await page.goto('/exercises/lightest-compounds');
  const editor = page.getByLabel(/^Answer for/);
  await editor.fill('SELECT preferred_name FROM compounds LIMIT 2');
  await expect(page.locator('.exercise__cases .is-fail').first()).toBeVisible({
    timeout: 60_000,
  });

  await editor.fill(
    'SELECT c.preferred_name AS name, c.formula, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY s.molecular_weight LIMIT 5',
  );
  await expect(page.locator('.exercise__done')).toContainText(
    'Every requirement is met.',
  );
  await expect(page.locator('.exercise__cases .is-fail')).toHaveCount(0);
});

test('a hint is revealed one at a time', async ({ page }) => {
  await page.goto('/exercises/lightest-compounds');
  await expect(page.locator('.exercise__hint')).toHaveCount(0);
  await page.getByRole('button', { name: /Reveal hint/ }).click();
  await expect(page.locator('.exercise__hint')).toHaveCount(1);
  await page.getByRole('button', { name: /Reveal hint/ }).click();
  await expect(page.locator('.exercise__hint')).toHaveCount(2);
});

test('the cheatsheet lists every section', async ({ page }) => {
  await page.goto('/cheatsheet');
  await expect(page.locator('.cheatsheet__section')).toHaveCount(7);
  await expect(
    page.locator('.cheatsheet__table tbody tr').first(),
  ).toBeVisible();
});

test('the schema page reports the real row counts', async ({ page }) => {
  await page.goto('/schema');
  await expect(page.locator('#table-compounds .schema__rows')).toHaveText(
    '541 rows',
  );
  await expect(page.locator('#table-nmr_couplings .schema__rows')).toHaveText(
    '197 rows',
  );
});

test('the schema diagram draws every table, and each box opens its columns', async ({
  page,
}) => {
  await page.goto('/schema');
  await expect(page.locator('.schema__diagram .schema__node')).toHaveCount(16);
  await expect(page.locator('.schema__diagram .schema__edge')).toHaveCount(17);
  await page.locator('.schema__node[href="#table-nmr_couplings"]').click();
  await expect(page.locator('#table-nmr_couplings')).toBeInViewport();
});

test('a glossary term explains itself on hover', async ({ page }) => {
  await page.goto('/tutorial/select-columns');
  const term = page.locator('.glossary-term').first();
  await expect(term).toBeVisible();
  await term.hover();
  await expect(page.locator('.glossary-card__title')).toBeVisible();
});

test('the browser shows one compound with everything that points at it', async ({
  page,
}) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('7-Bromo');
  await page.locator('.browse__entry').first().click({ timeout: 60_000 });

  await expect(page.locator('.detail__name')).toHaveText('7-Bromo-1H-indole');
  // Its CAS, reformatted from the bare digits the source stores.
  await expect(page.getByText('CAS 51417-51-7')).toBeVisible();
  // Both languages the suppliers name it in.
  await expect(page.locator('.detail__names')).toContainText('7-Brom-1H-indol');
  await expect(page.locator('.detail__names')).toContainText(
    '7-Bromo-1H-indole',
  );
  // Two listings, each with its own claim.
  await expect(page.locator('.detail__listing')).toHaveCount(2);
  await expect(page.locator('.detail__claims').first()).toContainText(
    '46–47°C',
  );
});

test('an NMR spectrum is drawn, with its ranges and couplings', async ({
  page,
}) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('7-Bromo');
  await page.locator('.browse__entry').first().click({ timeout: 60_000 });

  const trace = page.locator('.spectrum__trace').first();
  await expect(trace).toBeVisible({ timeout: 30_000 });
  // The trace is a real path, not an empty one.
  const path = await trace.getAttribute('d');
  expect(path?.length ?? 0).toBeGreaterThan(1000);
  // One shaded band per picked range.
  await expect(page.locator('.spectrum__band')).toHaveCount(5);
  // And the coupling constants of the dd are on the page.
  await expect(page.locator('.detail__ranges')).toContainText('3.16, 2.21');
});

test('an IR spectrum shows the supplier bands beside the picked ones', async ({
  page,
}) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('Ethanol');
  await page
    .locator('.browse__entry')
    .filter({ hasText: /^Ethanol/ })
    .first()
    .click({ timeout: 60_000 });

  await expect(page.locator('.spectrum__trace').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('.detail__spectrum header')).toContainText(
    '11 reported',
  );
  await expect(page.locator('.detail__spectrum header')).toContainText(
    '13 picked',
  );
  await expect(page.locator('.spectrum__marker')).toHaveCount(24);
});

test('the arrow keys move through the compounds', async ({ page }) => {
  await page.goto('/browse');
  await page.locator('.browse__entry').first().click({ timeout: 60_000 });
  const first = await page.locator('.detail__name').textContent();
  await page.locator('.detail').click();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.detail__name')).not.toHaveText(first ?? '');
});

test('a browsed compound travels in the address', async ({ page }) => {
  await page.goto('/browse');
  await page.getByPlaceholder(/Name, formula or SMILES/).fill('Ethanol');
  await page
    .locator('.browse__entry')
    .filter({ hasText: /^Ethanol/ })
    .first()
    .click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/browse\?compound=\d+/);

  const url = page.url();
  await page.goto(url);
  await expect(page.locator('.detail__name')).toHaveText('Ethanol', {
    timeout: 60_000,
  });
});
