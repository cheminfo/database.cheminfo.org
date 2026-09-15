import { Molecule, SSSearcherWithIndex } from 'openchemlib';
import { expect, test } from 'vitest';

import {
  INDEX_BIT_COUNT,
  indexBits,
  indexFragments,
} from '../indexFragments.ts';

test('bit 0 is the high bit of the first word', () => {
  const index = Array.from({ length: 16 }, () => 0);
  index[0] = 0x80000000 | 1;
  index[15] = 1;

  expect(indexBits(index)).toStrictEqual([0, 31, INDEX_BIT_COUNT - 1]);
});

test('the index has one key fragment per bit', () => {
  expect(SSSearcherWithIndex.getKeyIDCode()).toHaveLength(INDEX_BIT_COUNT);
});

test('the fragments listed are exactly the bits getIndex sets', () => {
  const listed: Record<string, number[]> = {};
  const set: Record<string, number[]> = {};
  for (const smiles of [
    'c1ccccc1CCO',
    'CC(=O)Oc1ccccc1C(=O)O',
    'CN1CCC[C@H]1c1cccnc1',
    '[O-][N+](=O)c1ccc(Cl)cc1',
    'C=CC#N',
  ]) {
    const molecule = Molecule.fromSmiles(smiles);
    listed[smiles] = indexFragments(molecule).map((fragment) => fragment.bit);
    set[smiles] = indexBits(molecule.getIndex());
  }

  expect(listed).toStrictEqual(set);
});

test('a query fragment is explained with the same rules', () => {
  const query = Molecule.fromSmiles('c1ccccc1O');
  query.setFragment(true);
  const fragments = indexFragments(query);

  expect(fragments.map((fragment) => fragment.bit)).toStrictEqual(
    indexBits(query.getIndex()),
  );
  expect(fragments).toHaveLength(8);
});

test('a fragment reports its word, its mask and every place it matches', () => {
  const molecule = Molecule.fromSmiles('c1ccccc1CCO');
  const aromaticBond = indexFragments(molecule).find(
    (fragment) => fragment.bit === 7,
  );

  expect(aromaticBond).toStrictEqual({
    bit: 7,
    word: 0,
    mask: 16777216,
    idCode: 'RF@QPvR@',
    atoms: [
      [0, 1],
      [0, 5],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ],
    bonds: [
      [molecule.getBond(0, 1)],
      [molecule.getBond(0, 5)],
      [molecule.getBond(1, 2)],
      [molecule.getBond(2, 3)],
      [molecule.getBond(3, 4)],
      [molecule.getBond(4, 5)],
    ],
  });
});
