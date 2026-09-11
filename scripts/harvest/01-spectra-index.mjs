/**
 * Find catalogue entries that carry an IR or a 1H NMR spectrum.
 *
 * ChemExper answers a substructure search with at most 100 entries and offers
 * no pagination, so breadth comes from asking many different questions: one
 * query per seed structure, unioned by entry identifier.
 */
import { join } from 'node:path';

import { DELAY_MS, searchByTechnique, sleep, writeJson } from './lib.mjs';

const OUT = join(import.meta.dirname, '../../data/raw');

/** Seeds chosen to spread over functional groups, ring systems and elements. */
const SEEDS = [
  'CCO', 'CC(=O)O', 'CC(=O)C', 'CC=O', 'CCN', 'CCCl', 'CCBr', 'CCI', 'CCF',
  'CC#N', 'CCS', 'CCOC', 'CC(=O)N', 'CC(=O)OC', 'CCOC(=O)C', 'CS(=O)(=O)O',
  'CN(C)C', 'CC(C)O', 'CC(C)(C)O', 'OCCO', 'OCC(O)CO', 'NCCN', 'OC(=O)CC(=O)O',
  'c1ccccc1', 'Cc1ccccc1', 'Oc1ccccc1', 'Nc1ccccc1', 'Clc1ccccc1',
  'O=Cc1ccccc1', 'OC(=O)c1ccccc1', 'O=C(C)c1ccccc1', 'N#Cc1ccccc1',
  'O=[N+]([O-])c1ccccc1', 'c1ccc2ccccc2c1', 'c1ccc2c(c1)cccc2',
  'c1ccncc1', 'c1ccnc(c1)C', 'c1cc[nH]c1', 'c1ccoc1', 'c1ccsc1',
  'c1cnc[nH]1', 'c1ccc2[nH]ccc2c1', 'C1CCCCC1', 'C1CCOC1', 'C1CCNCC1',
  'C1CCOCC1', 'C1CO1', 'O=C1CCCCC1', 'O=C1CCCN1', 'O=C1CCCO1',
  'CCCCCCCC', 'CCCCCCCCCCCC', 'C=CC', 'C#CC', 'CC(C)=C',
  'OS(=O)(=O)O', 'O=P(O)(O)O', 'B(O)O', 'C[Si](C)(C)C',
  'FC(F)(F)C', 'ClC(Cl)Cl', 'BrCCBr', 'OCc1ccccc1', 'NC(=O)c1ccccc1',
  'O=S(=O)(N)c1ccccc1', 'Cc1ccc(cc1)S(=O)(=O)O', 'OC(=O)C(N)C',
  'OC(=O)CCC(=O)O', 'C1=CC=C(C=C1)C=CC(=O)O', 'OC1C(O)C(O)C(O)C(O)C1O',
];

const index = new Map();

for (const technique of ['IR', 'NMR']) {
  let seen = 0;
  for (const [position, smiles] of SEEDS.entries()) {
    const body = await searchByTechnique(technique, smiles);
    await sleep(DELAY_MS);
    if (!body?.entry) continue;
    for (const item of body.entry) {
      const value = item?.value;
      if (!value?._entryID) continue;
      const existing = index.get(value._entryID) ?? {
        entryId: value._entryID,
        supplierName: value.supplierName ?? '',
        mf: value.mf?.[0]?.value?.value ?? '',
        mw: value.mf?.[0]?.mw ?? null,
        name: value.iupac?.find((n) => n.language === 'en')?.value ?? value.iupac?.[0]?.value ?? '',
        techniques: [],
      };
      if (!existing.techniques.includes(technique)) existing.techniques.push(technique);
      index.set(value._entryID, existing);
    }
    seen = index.size;
    process.stdout.write(
      `\r${technique} seed ${position + 1}/${SEEDS.length} (${smiles.padEnd(24)}) total found ${String(body.totalFound ?? '?').padStart(6)}  union ${seen}   `,
    );
  }
  process.stdout.write('\n');
}

const entries = [...index.values()];
const withIr = entries.filter((e) => e.techniques.includes('IR'));
const withNmr = entries.filter((e) => e.techniques.includes('NMR'));

await writeJson(join(OUT, 'spectra-index.json'), entries);
process.stdout.write(
  `\nunion ${entries.length} entries — IR ${withIr.length}, NMR ${withNmr.length}, both ${entries.filter((e) => e.techniques.length === 2).length}\n`,
);
