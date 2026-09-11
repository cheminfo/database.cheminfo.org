import type { Database } from '@sqlite.org/sqlite-wasm';

import type { Exercise } from '../data/exercises.ts';

import { runMango } from './runMango.ts';
import { runSql } from './runSql.ts';

export interface AnswerCheck {
  /** Whether every requirement was met. */
  passed: boolean;
  /** One line per requirement, in the order they are checked. */
  cases: Array<{ description: string; passed: boolean; reason: string }>;
  /** What went wrong before any requirement could be checked. */
  error: string | null;
}

/**
 * Judge an attempt against what the exercise says its answer must be.
 *
 * A reason is written the way a tutor would say it — what the query gave and
 * what was wanted — because that sentence is the only thing a stuck student
 * reads.
 * @param exercise - The exercise being answered.
 * @param query - What the student wrote.
 * @param context - Where to run it.
 * @param context.database - The opened database, for an SQL answer.
 * @param context.documents - The documents, for a Mango answer.
 * @returns Which requirements the attempt met.
 */
export function checkAnswer(
  exercise: Exercise,
  query: string,
  context: { database: Database; documents: Array<Record<string, unknown>> },
): AnswerCheck {
  const cases: AnswerCheck['cases'] = [];
  let rows: unknown[][];
  let columns: string[];

  try {
    if (looksLikeMango(query)) {
      const parsed = JSON.parse(query) as Parameters<typeof runMango>[1];
      const result = runMango(context.documents, parsed, {
        maxDocuments: 5000,
      });
      columns = parsed.fields ?? [];
      rows = result.docs.map((doc) =>
        columns.map((field) => leafValue(doc, field)),
      );
    } else {
      const result = runSql(context.database, query, { maxRows: 5000 });
      columns = result.columns;
      rows = result.rows;
    }
  } catch (error) {
    return {
      passed: false,
      cases: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  cases.push({
    description: `returns ${exercise.expect.rowCount} rows`,
    passed: rows.length === exercise.expect.rowCount,
    reason:
      rows.length === exercise.expect.rowCount
        ? `${rows.length} rows`
        : `got ${rows.length} rows, expected ${exercise.expect.rowCount}`,
  });

  if (exercise.expect.columns) {
    const wanted = exercise.expect.columns;
    const same =
      wanted.length === columns.length &&
      wanted.every((name, i) => name === columns[i]);
    cases.push({
      description: `the columns are ${wanted.join(', ')}`,
      passed: same,
      reason: same
        ? 'the columns match'
        : `got ${columns.join(', ') || '(none)'}`,
    });
  }

  if (exercise.expect.firstRow) {
    const wanted = exercise.expect.firstRow;
    const same = sameRow(rows[0], wanted);
    cases.push({
      description: 'the first row is the expected one',
      passed: same,
      reason: same
        ? 'the first row matches'
        : `got ${show(rows[0])}, expected ${show(wanted)}`,
    });
  }

  for (const wanted of exercise.expect.contains ?? []) {
    const found = rows.some((row) => sameRow(row, wanted));
    cases.push({
      description: `${show(wanted)} is in the answer`,
      passed: found,
      reason: found ? 'it is there' : 'it is missing from the answer',
    });
  }

  return { passed: cases.every((item) => item.passed), cases, error: null };
}

function looksLikeMango(query: string): boolean {
  return query.trim().startsWith('{');
}

function leafValue(doc: Record<string, unknown>, path: string): unknown {
  let value: unknown = doc;
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Numbers are compared loosely, so 17.03 answers 17.0305 rather than failing. */
function sameRow(row: unknown[] | undefined, wanted: unknown[]): boolean {
  if (row?.length !== wanted.length) return false;
  return wanted.every((value, index) => {
    const actual = row[index];
    if (typeof value === 'number' && typeof actual === 'number') {
      return Math.abs(value - actual) <= Math.max(1e-6, Math.abs(value) * 1e-4);
    }
    return String(actual) === String(value);
  });
}

function show(row: unknown[] | undefined): string {
  if (!row) return '(no row)';
  return `[${row.map((value) => (typeof value === 'string' ? `"${value}"` : String(value))).join(', ')}]`;
}
