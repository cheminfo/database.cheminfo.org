/**
 * Read the catalogue record of every listing the database will carry.
 *
 * The first pass only fetched the listings it went looking for, so a compound
 * gathered later — one whose siblings came out of the reference dump — kept
 * listings with no supplier, no names of their own and no hazard statements.
 * This fills them in, and folds the new records back into `compounds.json`.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { DELAY_MS, entryDetails, readJson, sleep, writeJson } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const CACHE = join(RAW, 'details');

const compounds = await readJson(join(RAW, 'compounds.json'));
const cached = new Set(
  (await readdir(CACHE).catch(() => [])).map((file) => Number(file.replace('.json', ''))),
);

const missing = [];
for (const compound of compounds) {
  const have = new Set(compound.records.map((record) => record._entryID));
  for (const listing of compound.dumpEntries) {
    if (!have.has(listing.entryID)) missing.push({ compound, entryId: listing.entryID });
  }
}
process.stdout.write(`${missing.length} listings have no catalogue record yet\n`);

let fetched = 0;
let failed = 0;
for (const [position, item] of missing.entries()) {
  let record;
  if (cached.has(item.entryId)) {
    record = await readJson(join(CACHE, `${item.entryId}.json`));
  } else {
    record = await entryDetails(item.entryId);
    await sleep(DELAY_MS);
    if (record) {
      record._group = 'backfill';
      await writeJson(join(CACHE, `${item.entryId}.json`), record);
    }
  }
  if (!record) {
    failed++;
    continue;
  }
  item.compound.records.push(record);
  fetched++;
  if (position % 25 === 0) {
    process.stdout.write(`\r  ${position + 1}/${missing.length} — ${fetched} filled, ${failed} failed   `);
  }
}
process.stdout.write(`\r  ${missing.length}/${missing.length} — ${fetched} filled, ${failed} failed\n`);

await writeJson(join(RAW, 'compounds.json'), compounds);
process.stdout.write(
  `records per compound now: ${compounds.reduce((sum, c) => sum + c.records.length, 0)} across ${compounds.length} compounds\n`,
);
