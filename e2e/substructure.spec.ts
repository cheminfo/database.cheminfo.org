import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { Molecule } from 'openchemlib';

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

test('a bond drawn in the editor becomes the query the search runs', async ({
  page,
}) => {
  await page.goto('/substructure');
  const funnel = page.locator('.substructure__funnel strong');
  await expect(funnel).toHaveText(['215', '188'], { timeout: 60_000 });

  const { toolbar, drawing } = await editorGeometry(page);

  await page.mouse.move(toolbar.x + 12, toolbar.y + 2 + 5 * 21 + 10);
  await expect(page.getByTestId('structure-editor-tooltip')).toContainText(
    'Single bond',
  );

  // Empty space, away from the benzene ring in the middle and the help button
  // in the top-right corner: the default tool drops a C–C bond there.
  await page.mouse.click(
    drawing.x + drawing.width - 40,
    drawing.y + drawing.height - 40,
  );

  const ringAndBond = Molecule.fromSmiles('c1ccccc1.CC');
  ringAndBond.setFragment(true);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('structure'))
    .toBe(ringAndBond.getIDCode());
  await expect(page.locator('.index-grid__cell--on')).toHaveCount(4);
  await expect(funnel).toHaveText(['172', '95']);
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the structure editor's toolbar and drawing canvas are on the page. Both
 * live in the editor's shadow root, which locators do not reliably pierce.
 * @param page - The page holding the editor.
 * @returns The two boxes, once the drawing canvas has been laid out.
 */
async function editorGeometry(
  page: Page,
): Promise<{ toolbar: Box; drawing: Box }> {
  const handle = await page.waitForFunction(() => {
    const root = document.querySelector('[data-openchemlib-canvas-editor]');
    const toolbar = root?.shadowRoot?.firstElementChild;
    const drawing = root?.shadowRoot?.querySelector('canvas[tabindex]');
    if (!toolbar || !drawing) return null;
    const toolbarBox = toolbar.getBoundingClientRect();
    const drawingBox = drawing.getBoundingClientRect();
    if (drawingBox.width === 0 || drawingBox.height === 0) return null;
    const plain = ({ x, y, width, height }: DOMRect) => ({
      x,
      y,
      width,
      height,
    });
    return { toolbar: plain(toolbarBox), drawing: plain(drawingBox) };
  });
  const geometry = await handle.jsonValue();
  if (!geometry) throw new Error('the structure editor never laid out');
  return geometry;
}
