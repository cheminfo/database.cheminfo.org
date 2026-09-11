/**
 * Find substances whose listings disagree — several boiling points at several
 * pressures, or melting points that do not match.
 *
 * These are the rows that make a join worth writing: a compound is not one
 * boiling point, it is a set of claims, each made at a stated pressure.
 */
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';

import { DELAY_MS, entryDetails, readJson, sleep, writeJson } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const DUMP = '/Users/lpatiny/git/cheminfo/reference.cheminfo.org/data/data.json.gz';

/** How many disagreeing substances to add to the selection. */
const WANTED = 45;

async function* dumpRecords() {
  const stream = createReadStream(DUMP).pipe(createGunzip());
  stream.setEncoding('utf8');
  let carry = '';
  let lines = [];
  let inside = false;
  for await (const chunk of stream) {
    carry += chunk;
    const parts = carry.split('\n');
    carry = parts.pop() ?? '';
    for (const line of parts) {
      if (line === '  {') {
        inside = true;
        lines = ['{'];
      } else if (inside && (line === '  }' || line === '  },')) {
        lines.push('}');
        inside = false;
        yield JSON.parse(lines.join('\n'));
      } else if (inside) {
        lines.push(line);
      }
    }
  }
}

const groups = new Map();
for await (const record of dumpRecords()) {
  if (!record.bp && !record.mp && !record.density) continue;
  const list = groups.get(record.idCodeNoStereo) ?? [];
  list.push(record);
  groups.set(record.idCodeNoStereo, list);
}
process.stdout.write(`${groups.size} structures carry at least one property listing\n`);

function readableName(records) {
  const names = records.flatMap((r) => r.iupac ?? []);
  const clean = names
    .filter((n) => !/^(zinc|ai3-|einecs|albb|nsc|brn|caswell)/i.test(n))
    .sort((a, b) => a.length - b.length);
  return clean[0] ?? names[0] ?? '';
}

const candidates = [];
for (const [key, records] of groups) {
  if (records.length < 2) continue;
  const pressures = new Set(
    records.filter((r) => r.bp?.pressure !== undefined).map((r) => r.bp.pressure),
  );
  const boiling = new Set(records.filter((r) => r.bp).map((r) => JSON.stringify(r.bp)));
  const melting = new Set(records.filter((r) => r.mp).map((r) => JSON.stringify(r.mp)));
  if (pressures.size < 2 && boiling.size < 2 && melting.size < 2) continue;
  const name = readableName(records);
  if (!name || name.length > 40) continue;
  candidates.push({
    idCodeNoStereo: key,
    name,
    listings: records.length,
    pressures: pressures.size,
    differingBp: boiling.size,
    differingMp: melting.size,
    records,
    // Several pressures is the teaching case; disagreement is the runner-up.
    score: pressures.size * 10 + boiling.size * 3 + melting.size + Math.min(records.length, 6),
  });
}

candidates.sort((a, b) => b.score - a.score);
process.stdout.write(
  `${candidates.length} disagreeing substances; best scores ${candidates.slice(0, 5).map((c) => `${c.name}(${c.pressures}p/${c.listings}L)`).join(', ')}\n`,
);

const chosen = candidates.slice(0, WANTED);
const compounds = await readJson(join(RAW, 'compounds.json'));
const already = new Set(compounds.map((c) => c.idCodeNoStereo));

const added = [];
for (const candidate of chosen) {
  if (already.has(candidate.idCodeNoStereo)) continue;
  const records = [];
  for (const listing of candidate.records.slice(0, 8)) {
    const record = await entryDetails(listing.entryID);
    await sleep(DELAY_MS);
    if (record) {
      record._group = 'disagreement';
      records.push(record);
    }
  }
  if (records.length === 0) continue;
  added.push({
    idCode: candidate.records[0].idCode,
    idCodeNoStereo: candidate.idCodeNoStereo,
    smiles: candidate.records[0].smiles,
    records,
    dumpEntries: candidate.records,
    hasIr: false,
    hasNmr: false,
    nbSuppliers: Math.max(0, ...candidate.records.map((r) => r.nbSuppliers ?? 0)),
  });
  process.stdout.write(
    `\r  added ${added.length}/${WANTED}: ${candidate.name.padEnd(38).slice(0, 38)}`,
  );
}
process.stdout.write('\n');

await writeJson(join(RAW, 'compounds.json'), [...compounds, ...added]);
process.stdout.write(`compounds.json now holds ${compounds.length + added.length} compounds\n`);
