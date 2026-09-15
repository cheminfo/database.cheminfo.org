import { Molecule } from 'openchemlib';
import { beforeAll, expect, test } from 'vitest';

import type { ShippedDatabase } from '../../data/__tests__/openShippedDatabase.ts';
import { openShippedDatabase } from '../../data/__tests__/openShippedDatabase.ts';
import { runSql } from '../../query/runSql.ts';
import {
  firstMatch,
  indexWords,
  screeningSql,
  searchSubstructure,
} from '../substructureSearch.ts';

let shipped: ShippedDatabase;

beforeAll(async () => {
  shipped = await openShippedDatabase();
}, 60_000);

function fragment(smiles: string): Molecule {
  const molecule = Molecule.fromSmiles(smiles);
  molecule.setFragment(true);
  return molecule;
}

test('the screen writes only the words the query sets', () => {
  expect(screeningSql(indexWords(fragment('Br')))).toBe(
    `SELECT c.id, c.preferred_name
FROM structures s
JOIN compounds c ON c.id = s.compound_id
WHERE (s.index15 & 1024) = 1024
ORDER BY c.id`,
  );
});

test('the index screens, and comparing atoms decides', () => {
  const benzene = searchSubstructure(shipped.database, fragment('c1ccccc1'));

  expect(benzene.screened).toBe(215);
  expect(benzene.hits).toHaveLength(188);
  expect(benzene.hits.slice(0, 2).map((hit) => hit.name)).toStrictEqual([
    '7-Bromo-1H-indole',
    'Toluene',
  ]);

  const bromine = searchSubstructure(shipped.database, fragment('Br'));

  expect([bromine.screened, bromine.hits.length]).toStrictEqual([39, 30]);
});

test('a carboxylic acid is never screened in by accident', () => {
  const acid = searchSubstructure(shipped.database, fragment('C(=O)[OH]'));

  expect([acid.screened, acid.hits.length]).toStrictEqual([158, 158]);
});

test('the screening SQL, run in the playground, returns the candidates compared', () => {
  const result = searchSubstructure(shipped.database, fragment('Br'));
  const rows = runSql(shipped.database, result.screeningSql, {
    maxRows: 500,
  }).rows;

  expect(rows).toHaveLength(result.screened);
  expect(rows[0]).toStrictEqual([14, '7-Bromo-1H-indole']);
});

test('a match is painted where the query sits, and nowhere when it is absent', () => {
  const query = fragment('c1ccccc1');
  const benzene = searchSubstructure(shipped.database, query);
  const toluene = benzene.hits[1];
  const ethanol = Molecule.fromSmiles('CCO').getIDCode();

  expect(toluene?.name).toBe('Toluene');

  const match = firstMatch(toluene?.idCode ?? '', query);

  expect([match.atoms.length, match.bonds.length]).toStrictEqual([6, 6]);
  expect(firstMatch(ethanol, query)).toStrictEqual({ atoms: [], bonds: [] });
});
