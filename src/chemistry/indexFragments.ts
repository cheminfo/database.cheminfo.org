import type { Molecule } from 'openchemlib';
import {
  Molecule as OCLMolecule,
  SSSearcher,
  SSSearcherWithIndex,
} from 'openchemlib';

/** One key fragment of the substructure index that a structure contains. */
export interface IndexFragment {
  /** The bit the fragment sets, from 0 to 511. */
  bit: number;
  /** The word of `Molecule.getIndex()` holding that bit, from 0 to 15. */
  word: number;
  /** The mask selecting the bit inside its word, as an unsigned 32-bit number. */
  mask: number;
  /** The key fragment, as an idCode. */
  idCode: string;
  /**
   * Every match of the fragment in the structure: for each fragment atom, the
   * structure atom it maps to.
   */
  atoms: number[][];
  /** The structure bonds each match covers, in the order of `atoms`. */
  bonds: number[][];
}

/** How many bits the substructure index of OpenChemLib holds. */
export const INDEX_BIT_COUNT = 512;

/**
 * Explain the substructure index of a structure: which key fragments it
 * contains, the bit each of them sets, and where each one matches.
 *
 * The key fragments are the 512 idCodes `SSSearcherWithIndex.getKeyIDCode()`
 * returns, in bit order. They are matched with the rule `getIndex()` itself
 * uses, a double bond also matching a delocalized one, so the bits listed are
 * exactly the bits set, for a molecule as for a query fragment.
 * @param molecule - A molecule, or a query drawn with `setFragment(true)`.
 * @returns One entry per set bit, in bit order.
 */
export function indexFragments(molecule: Molecule): IndexFragment[] {
  const keys = SSSearcherWithIndex.getKeyIDCode();
  const searcher = new SSSearcher({ matchDBondToDelocalized: true });
  searcher.setMolecule(molecule);
  const fragments: IndexFragment[] = [];
  for (const bit of indexBits(molecule.getIndex())) {
    const idCode = keys[bit] ?? '';
    const fragment = keyFragment(bit, idCode);
    searcher.setFragment(fragment);
    searcher.findFragmentInMolecule({ countMode: 'overlapping' });
    const atoms = searcher.getMatchList();
    const bonds: number[][] = [];
    for (const match of atoms) {
      bonds.push(matchedBonds(fragment, molecule, match));
    }
    fragments.push({
      bit,
      word: bit >> 5,
      mask: (1 << (31 - (bit & 31))) >>> 0,
      idCode,
      atoms,
      bonds,
    });
  }
  return fragments;
}

/**
 * List the bits set in a substructure index.
 *
 * Bits are counted the way OpenChemLib sets them: bit 0 is the most
 * significant bit of the first word, bit 31 its least significant one, and bit
 * 32 the most significant bit of the second word.
 * @param index - The sixteen words `Molecule.getIndex()` returns.
 * @returns The positions of the set bits, in increasing order.
 */
export function indexBits(index: ArrayLike<number>): number[] {
  const bits: number[] = [];
  for (let word = 0; word < index.length; word++) {
    const value = index[word] ?? 0;
    if (value === 0) continue;
    for (let offset = 0; offset < 32; offset++) {
      if ((value & (1 << (31 - offset))) !== 0) bits.push(word * 32 + offset);
    }
  }
  return bits;
}

/**
 * The structure bonds a match of a fragment covers.
 * @param fragment - The fragment that was searched.
 * @param molecule - The structure it was found in.
 * @param match - For each fragment atom, the structure atom it maps to, or -1.
 * @returns The covered bonds of the structure, in fragment bond order.
 */
export function matchedBonds(
  fragment: Molecule,
  molecule: Molecule,
  match: readonly number[],
): number[] {
  const bonds: number[] = [];
  for (let bond = 0; bond < fragment.getAllBonds(); bond++) {
    const atom1 = match[fragment.getBondAtom(0, bond)] ?? -1;
    const atom2 = match[fragment.getBondAtom(1, bond)] ?? -1;
    if (atom1 === -1 || atom2 === -1) continue;
    const matched = molecule.getBond(atom1, atom2);
    if (matched !== -1) bonds.push(matched);
  }
  return bonds;
}

const keyFragments = new Map<number, Molecule>();

function keyFragment(bit: number, idCode: string): Molecule {
  let fragment = keyFragments.get(bit);
  if (!fragment) {
    fragment = OCLMolecule.fromIDCode(idCode);
    fragment.setFragment(true);
    keyFragments.set(bit, fragment);
  }
  return fragment;
}
