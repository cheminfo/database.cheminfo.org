/**
 * Read the full catalogue record of every entry the database will carry.
 *
 * Three groups are fetched: the entries that hold an IR spectrum, the entries
 * that hold a 1H NMR spectrum, and the pool of well-known products selected
 * from the reference dump. Records are cached on disk so the harvest can be
 * re-run without asking ChemExper the same question twice.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { DELAY_MS, entryDetails, readJson, sleep, writeJson } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const CACHE = join(RAW, 'details');

/** How many candidates to read per technique, before the ones that fail are dropped. */
const IR_CANDIDATES = 170;
const NMR_CANDIDATES = 110;

/** A name a student would recognise beats a catalogue string. */
function nameScore(name) {
  if (!name) return -100;
  let score = 0;
  if (name.length <= 22) score += 3;
  if (name.length <= 12) score += 2;
  if (/^\d|^\(|^\[/.test(name)) score -= 2;
  if (/-d\d|deuter/i.test(name)) score -= 6;
  if (/\d{2,}/.test(name)) score -= 2;
  score -= (name.match(/[,()[\]]/g) ?? []).length * 0.4;
  return score;
}

function pickDiverse(entries, wanted) {
  const byKey = new Map();
  for (const entry of entries) {
    const key = `${entry.mf}|${entry.name.toLowerCase()}`;
    const previous = byKey.get(key);
    if (!previous || nameScore(entry.name) > nameScore(previous.name)) byKey.set(key, entry);
  }
  const unique = [...byKey.values()];
  const byFormula = new Map();
  for (const entry of unique) {
    const list = byFormula.get(entry.mf) ?? [];
    list.push(entry);
    byFormula.set(entry.mf, list);
  }
  // One per formula first, so the set spans structures rather than isomers.
  const chosen = [];
  for (const list of byFormula.values()) {
    list.sort((a, b) => nameScore(b.name) - nameScore(a.name));
    chosen.push(list[0]);
  }
  chosen.sort((a, b) => nameScore(b.name) - nameScore(a.name) || a.mw - b.mw);
  return chosen.slice(0, wanted);
}

const index = await readJson(join(RAW, 'spectra-index.json'));
const pool = await readJson(join(RAW, 'pool-500.json'));

const irCandidates = pickDiverse(index.filter((e) => e.techniques.includes('IR')), IR_CANDIDATES);
const nmrCandidates = pickDiverse(index.filter((e) => e.techniques.includes('NMR')), NMR_CANDIDATES);

const wanted = new Map();
for (const entry of irCandidates) wanted.set(entry.entryId, 'ir');
for (const entry of nmrCandidates) if (!wanted.has(entry.entryId)) wanted.set(entry.entryId, 'nmr');
for (const product of pool) if (!wanted.has(product.entryID)) wanted.set(product.entryID, 'pool');

process.stdout.write(
  `fetching ${wanted.size} records — ir ${irCandidates.length}, nmr ${nmrCandidates.length}, pool ${pool.length}\n`,
);

const cached = new Set(
  (await readdir(CACHE).catch(() => [])).map((file) => Number(file.replace('.json', ''))),
);

let done = 0;
let failed = 0;
for (const [entryId, group] of wanted) {
  done++;
  if (cached.has(entryId)) continue;
  const record = await entryDetails(entryId);
  await sleep(DELAY_MS);
  if (!record) {
    failed++;
    continue;
  }
  record._group = group;
  await writeJson(join(CACHE, `${entryId}.json`), record);
  if (done % 25 === 0) {
    process.stdout.write(`\r  ${done}/${wanted.size} fetched, ${failed} failed   `);
  }
}
process.stdout.write(`\r  ${done}/${wanted.size} fetched, ${failed} failed\n`);

await writeJson(join(RAW, 'wanted.json'), [...wanted].map(([entryId, group]) => ({ entryId, group })));
