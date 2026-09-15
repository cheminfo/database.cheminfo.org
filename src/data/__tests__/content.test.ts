import { beforeAll, describe, expect, test } from 'vitest';

import { runMango } from '../../query/runMango.ts';
import { runSql } from '../../query/runSql.ts';
import { CHEAT_SECTIONS } from '../cheatsheet.ts';
import { EXERCISES } from '../exercises.ts';
import { GLOSSARY } from '../glossary.ts';
import { SCHEMA } from '../schema.ts';
import { TUTORIAL_STEPS } from '../tutorialSteps.ts';

import type { ShippedDatabase } from './openShippedDatabase.ts';
import { openShippedDatabase } from './openShippedDatabase.ts';

let shipped: ShippedDatabase;

beforeAll(async () => {
  shipped = await openShippedDatabase();
}, 60_000);

function sql(query: string) {
  return runSql(shipped.database, query, { maxRows: 500 });
}

function mango(query: string) {
  return runMango(shipped.documents, JSON.parse(query) as Parameters<typeof runMango>[1], {
    maxDocuments: 500,
  });
}

describe('tutorial', () => {
  test.each(TUTORIAL_STEPS.map((step) => [step.id, step] as const))(
    '%s runs its SQL and returns rows',
    (_id, step) => {
      const result = sql(step.sql);
      expect(result.rows.length).toBeGreaterThan(0);
    },
  );

  test.each(TUTORIAL_STEPS.filter((step) => step.mango).map((step) => [step.id, step] as const))(
    '%s runs its Mango and matches something',
    (_id, step) => {
      expect(mango(step.mango as string).matched).toBeGreaterThan(0);
    },
  );

  test('a step offers either a Mango spelling or a reason there is none', () => {
    for (const step of TUTORIAL_STEPS) {
      expect(Boolean(step.mango) || Boolean(step.mangoNote), step.id).toBe(true);
    }
  });

  test('every step id is unique, so an address names one step', () => {
    const ids = TUTORIAL_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every glossary marker resolves to an entry', () => {
    const used = new Set<string>();
    const prose = [
      ...TUTORIAL_STEPS.map((step) => step.description),
      ...EXERCISES.map((exercise) => exercise.description),
    ].join(' ');
    for (const match of prose.matchAll(/\[\[(?<term>[^\]]+)\]\]/g)) {
      const term = match.groups?.term;
      if (term !== undefined) used.add(term.toLowerCase());
    }
    const missing = [...used].filter((term) => !(term in GLOSSARY));
    expect(missing).toStrictEqual([]);
    expect(used.size).toBeGreaterThan(0);
  });
});

describe('exercises', () => {
  test.each(EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
    '%s produces exactly what it says it produces',
    (_id, exercise) => {
      const result = sql(exercise.solution);
      expect(result.rows).toHaveLength(exercise.expect.rowCount);
      if (exercise.expect.columns) {
        expect(result.columns).toStrictEqual(exercise.expect.columns);
      }
      if (exercise.expect.firstRow) {
        expect(result.rows[0]).toStrictEqual(exercise.expect.firstRow);
      }
      for (const wanted of exercise.expect.contains ?? []) {
        expect(result.rows).toContainEqual(wanted);
      }
    },
  );

  test.each(
    EXERCISES.filter((exercise) => exercise.mangoSolution).map(
      (exercise) => [exercise.id, exercise] as const,
    ),
  )('%s has a Mango solution that matches the same count', (_id, exercise) => {
    expect(mango(exercise.mangoSolution as string).matched).toBe(exercise.expect.rowCount);
  });

  test('every exercise has a hint ladder of two to four steps', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.hints.length, exercise.id).toBeGreaterThanOrEqual(2);
      expect(exercise.hints.length, exercise.id).toBeLessThanOrEqual(4);
    }
  });

  test('every exercise id is unique', () => {
    const ids = EXERCISES.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('cheatsheet', () => {
  const sqlExamples = CHEAT_SECTIONS.flatMap((section) =>
    section.rows.flatMap((row) => {
      const sql = row.example?.sql;
      return sql ? [[`${section.title} — ${row.concept}`, sql] as const] : [];
    }),
  );
  const mangoExamples = CHEAT_SECTIONS.flatMap((section) =>
    section.rows.flatMap((row) => {
      const mango = row.example?.mango;
      return mango ? [[`${section.title} — ${row.concept}`, mango] as const] : [];
    }),
  );

  test('there are examples to check', () => {
    expect(sqlExamples.length).toBeGreaterThan(20);
    expect(mangoExamples.length).toBeGreaterThan(10);
  });

  test.each(sqlExamples)('%s runs its SQL example', (_label, query) => {
    expect(() => sql(query)).not.toThrow();
  });

  test.each(mangoExamples)('%s runs its Mango example', (_label, query) => {
    expect(() => mango(query)).not.toThrow();
  });
});

describe('schema', () => {
  test.each(SCHEMA.map((table) => [table.name, table] as const))(
    '%s reports the row count it actually holds',
    (_name, table) => {
      const result = sql(`SELECT COUNT(*) FROM "${table.name}"`);
      expect(result.rows[0]?.[0]).toBe(table.rowCount);
    },
  );

  test.each(SCHEMA.map((table) => [table.name, table] as const))(
    '%s lists exactly the columns it has',
    (_name, table) => {
      const actual = sql(`SELECT name FROM pragma_table_info('${table.name}')`).rows.map((row) =>
        String(row[0]),
      );
      expect(table.columns.map((column) => column.name)).toStrictEqual(actual);
    },
  );

  test('every table and view of the database is described', () => {
    const actual = sql(
      `SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).rows.map((row) => String(row[0]));
    expect(SCHEMA.map((table) => table.name).toSorted()).toStrictEqual(actual.toSorted());
  });
});
