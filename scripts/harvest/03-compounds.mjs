/**
 * Turn the fetched catalogue records into the compound set the database holds.
 *
 * A catalogue record describes one supplier's listing, not a substance: the
 * melting point, the boiling point and its pressure are that listing's claim.
 * So records are grouped by canonical structure, and every listing of a
 * structure is kept — which is where a compound gets several measurements.
 */
import { createReadStream } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';

import OCL from 'openchemlib';

import { readJson, writeJson } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const DUMP = '/Users/lpatiny/git/cheminfo/reference.cheminfo.org/data/data.json.gz';

/** How many compounds the shipped database carries. */
const TARGET_COMPOUNDS = 500;

function canonical(molfile) {
  try {
    const molecule = OCL.Molecule.fromMolfile(molfile);
    const idCode = molecule.getIDCode();
    molecule.stripStereoInformation();
    return { idCode, idCodeNoStereo: molecule.getIDCode(), smiles: molecule.toSmiles() };
  } catch {
    return null;
  }
}

const details = [];
for (const file of await readdir(join(RAW, 'details'))) {
  details.push(JSON.parse(await readFile(join(RAW, 'details', file), 'utf8')));
}

// Every record the harvest read, keyed by the structure it describes.
const byStructure = new Map();
let unparsable = 0;
for (const record of details) {
  const molfile = record.mol?.[0]?.value?.value;
  const structure = molfile ? canonical(molfile) : null;
  if (!structure) {
    unparsable++;
    continue;
  }
  const group = byStructure.get(structure.idCodeNoStereo) ?? { ...structure, records: [] };
  group.records.push(record);
  byStructure.set(structure.idCodeNoStereo, group);
}

process.stdout.write(
  `${details.length} records -> ${byStructure.size} structures (${unparsable} molfiles unreadable)\n`,
);

// The dump is pretty-printed with each record between a `  {` and a `  }` line.
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

const wanted = new Set(byStructure.keys());
const siblings = new Map();
let scanned = 0;
for await (const record of dumpRecords()) {
  scanned++;
  if (!wanted.has(record.idCodeNoStereo)) continue;
  const list = siblings.get(record.idCodeNoStereo) ?? [];
  list.push(record);
  siblings.set(record.idCodeNoStereo, list);
}
process.stdout.write(
  `scanned ${scanned} dump records, found listings for ${siblings.size} of the ${wanted.size} structures\n`,
);

const listingCounts = [...siblings.values()].map((l) => l.length);
listingCounts.sort((a, b) => b - a);
process.stdout.write(
  `listings per structure — max ${listingCounts[0]}, >1 for ${listingCounts.filter((c) => c > 1).length} structures, total ${listingCounts.reduce((a, b) => a + b, 0)}\n`,
);

const compounds = [];
for (const [key, group] of byStructure) {
  const dump = siblings.get(key) ?? [];
  const withIr = group.records.filter((r) => r.ir?.length);
  const withNmr = group.records.filter((r) => r.nmr?.length);
  compounds.push({
    ...group,
    dumpEntries: dump,
    hasIr: withIr.length > 0,
    hasNmr: withNmr.length > 0,
    nbSuppliers: Math.max(0, ...dump.map((d) => d.nbSuppliers ?? 0)),
  });
}

// Spectra first — they are the scarce thing — then the best-stocked of the rest.
compounds.sort((a, b) => {
  const spectra = Number(b.hasIr || b.hasNmr) - Number(a.hasIr || a.hasNmr);
  if (spectra !== 0) return spectra;
  return b.nbSuppliers - a.nbSuppliers;
});

const selected = compounds.slice(0, TARGET_COMPOUNDS);
process.stdout.write(
  `selected ${selected.length} compounds — ${selected.filter((c) => c.hasIr).length} with IR, ${selected.filter((c) => c.hasNmr).length} with NMR\n`,
);

await writeJson(join(RAW, 'compounds.json'), selected);
