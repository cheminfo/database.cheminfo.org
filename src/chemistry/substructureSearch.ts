import type { Database } from '@sqlite.org/sqlite-wasm';
import type { Molecule } from 'openchemlib';
import {
  Molecule as OCLMolecule,
  SSSearcher,
  SSSearcherWithIndex,
} from 'openchemlib';

import { matchedBonds } from './indexFragments.ts';

/** The sixteen index columns of `structures`, index00 holding bits 0 to 31. */
export const INDEX_COLUMNS: readonly string[] = Array.from(
  { length: 16 },
  (_, word) => `index${String(word).padStart(2, '0')}`,
);

/** A structure that really contains the query. */
export interface SubstructureHit {
  /** The compound it belongs to. */
  compoundId: number;
  /** The compound's preferred name. */
  name: string | null;
  /** The structure, as an idCode. */
  idCode: string;
}

/** What a two-step substructure search found, and what each step cost. */
export interface SubstructureSearchResult {
  /** The SQL a student can run to screen candidates on the index alone. */
  screeningSql: string;
  /** How many structures hold every bit of the query. */
  screened: number;
  /** The structures that really contain the query, in compound order. */
  hits: SubstructureHit[];
  /** Time the screening query took, in milliseconds. */
  screeningMs: number;
  /** Time the atom-by-atom comparison took, in milliseconds. */
  verificationMs: number;
}

/**
 * Read the substructure index of a structure as the unsigned 32-bit words the
 * `structures` table stores.
 * @param molecule - A molecule, or a query fragment.
 * @returns Sixteen words, index00 first.
 */
export function indexWords(molecule: Molecule): number[] {
  const words: number[] = [];
  for (const word of molecule.getIndex()) words.push(word >>> 0);
  return words;
}

/**
 * The SQL that keeps only the structures holding every bit a query holds.
 *
 * A word the query leaves at zero asks nothing, so it is not written, and a
 * query holding no bit at all screens nothing out.
 * @param words - The query's index, as `indexWords` returns it.
 * @returns A statement listing the candidates.
 */
export function screeningSql(words: readonly number[]): string {
  return `SELECT c.id, c.preferred_name
FROM structures s
JOIN compounds c ON c.id = s.compound_id${whereClause(words)}
ORDER BY c.id`;
}

/**
 * Find every structure of the database containing a query: first screen on
 * the index columns in SQL, then compare atoms on the candidates left.
 * @param database - The opened database.
 * @param query - The structure to look for; it is searched as a fragment.
 * @returns The candidates, the real hits and the time of each step.
 */
export function searchSubstructure(
  database: Database,
  query: Molecule,
): SubstructureSearchResult {
  const fragment = query.getCompactCopy();
  fragment.setFragment(true);
  const words = indexWords(fragment);

  const screeningStart = performance.now();
  const candidates: Array<SubstructureHit & { index: number[] }> = [];
  const statement = database.prepare(
    `SELECT c.id, c.preferred_name, c.id_code, ${INDEX_COLUMNS.map((column) => `s.${column}`).join(', ')}
     FROM structures s
     JOIN compounds c ON c.id = s.compound_id${whereClause(words)}
     ORDER BY c.id`,
  );
  try {
    while (statement.step()) {
      const row = statement.get([]);
      const index: number[] = [];
      for (let word = 0; word < INDEX_COLUMNS.length; word++) {
        index.push(Number(row[3 + word]) | 0);
      }
      candidates.push({
        compoundId: Number(row[0]),
        name: typeof row[1] === 'string' ? row[1] : null,
        idCode: typeof row[2] === 'string' ? row[2] : '',
        index,
      });
    }
  } finally {
    statement.finalize();
  }
  const screeningMs = performance.now() - screeningStart;

  const verificationStart = performance.now();
  const searcher = new SSSearcherWithIndex();
  searcher.setFragment(fragment, fragment.getIndex());
  const hits: SubstructureHit[] = [];
  for (const candidate of candidates) {
    searcher.setMolecule(
      OCLMolecule.fromIDCode(candidate.idCode),
      candidate.index,
    );
    if (searcher.isFragmentInMolecule()) {
      hits.push({
        compoundId: candidate.compoundId,
        name: candidate.name,
        idCode: candidate.idCode,
      });
    }
  }

  return {
    screeningSql: screeningSql(words),
    screened: candidates.length,
    hits,
    screeningMs,
    verificationMs: performance.now() - verificationStart,
  };
}

/**
 * Where a query first matches inside a structure, to paint it on a drawing.
 * @param idCode - The structure searched.
 * @param query - The query, searched as a fragment.
 * @returns The atoms and the bonds of the first match, both empty when none.
 */
export function firstMatch(
  idCode: string,
  query: Molecule,
): { atoms: number[]; bonds: number[] } {
  const molecule = OCLMolecule.fromIDCode(idCode);
  const fragment = query.getCompactCopy();
  fragment.setFragment(true);
  const searcher = new SSSearcher();
  searcher.setMol(fragment, molecule);
  if (searcher.findFragmentInMolecule({ countMode: 'firstMatch' }) === 0) {
    return { atoms: [], bonds: [] };
  }
  const match = searcher.getMatchList()[0] ?? [];
  const atoms: number[] = [];
  for (const atom of match) {
    if (atom !== -1) atoms.push(atom);
  }
  return { atoms, bonds: matchedBonds(fragment, molecule, match) };
}

function whereClause(words: readonly number[]): string {
  const conditions: string[] = [];
  for (let word = 0; word < words.length; word++) {
    const value = words[word] ?? 0;
    if (value === 0) continue;
    conditions.push(`(s.${INDEX_COLUMNS[word]} & ${value}) = ${value}`);
  }
  return conditions.length === 0
    ? ''
    : `\nWHERE ${conditions.join('\n  AND ')}`;
}
