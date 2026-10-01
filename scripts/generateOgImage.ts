/**
 * Draw `public/og.png`, the card a link to the site unfurls into.
 *
 * Run with `npm run og-image`. The card is drawn from the site's own record —
 * its mark, its two colours and its name — so it is regenerated rather than
 * hand-edited: a mark that changes must not leave a card showing the old one.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';
import { OG_HEIGHT, OG_WIDTH, ogCardHtml } from 'react-cheminfo/vite';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: OG_WIDTH, height: OG_HEIGHT },
});
await page.setContent(await ogCardHtml({ site: 'database' }), {
  waitUntil: 'load',
});
const png = await page.screenshot({ type: 'png' });
await browser.close();

const target = join(import.meta.dirname, '..', 'public', 'og.png');
writeFileSync(target, png);
process.stdout.write(`${target} written (${OG_WIDTH}×${OG_HEIGHT})\n`);
