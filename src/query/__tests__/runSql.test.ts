import type { Database } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { beforeAll, expect, test } from 'vitest';

import { installReadOnlyAuthorizer } from '../../data/loadDatabase.ts';
import { SqlError, runSql } from '../runSql.ts';

let database: Database;

beforeAll(async () => {
  const sqlite3 = await sqlite3InitModule();
  database = new sqlite3.oo1.DB();
  database.exec(`
    CREATE TABLE compounds (id INTEGER PRIMARY KEY, name TEXT, mass REAL);
    INSERT INTO compounds (name, mass) VALUES ('Water', 18.02), ('Ethanol', 46.07), ('Benzene', 78.11);
    CREATE TABLE names (compound_id INTEGER, value TEXT, language TEXT);
    INSERT INTO names VALUES (1, 'Water', 'en'), (1, 'Wasser', 'de'), (2, 'Ethanol', 'en');
  `);
  // Only now is the handle sealed, so the fixture above could be written.
  installReadOnlyAuthorizer(sqlite3, database);
});

test('a select returns its columns and rows', () => {
  const result = runSql(
    database,
    'SELECT name, mass FROM compounds ORDER BY mass',
  );
  expect(result.columns).toStrictEqual(['name', 'mass']);
  expect(result.rows).toStrictEqual([
    ['Water', 18.02],
    ['Ethanol', 46.07],
    ['Benzene', 78.11],
  ]);
  expect(result.truncated).toBe(false);
});

test('a join across two tables works', () => {
  const result = runSql(
    database,
    `SELECT c.name, COUNT(n.value) AS nb
     FROM compounds c LEFT JOIN names n ON n.compound_id = c.id
     GROUP BY c.id ORDER BY nb DESC, c.name`,
  );
  expect(result.rows).toStrictEqual([
    ['Water', 2],
    ['Ethanol', 1],
    ['Benzene', 0],
  ]);
});

test('the row cap truncates rather than growing without bound', () => {
  const result = runSql(database, 'SELECT name FROM compounds', { maxRows: 2 });
  expect(result.rows).toHaveLength(2);
  expect(result.truncated).toBe(true);
});

test('a recursive CTE is allowed', () => {
  const result = runSql(
    database,
    'WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 5) SELECT SUM(x) FROM n',
  );
  expect(result.rows[0]?.[0]).toBe(15);
});

test.each([
  ['DELETE FROM compounds'],
  ["UPDATE compounds SET name = 'x'"],
  ['CREATE TABLE t (a)'],
  ['DROP TABLE names'],
  ['ALTER TABLE names RENAME TO other'],
  ["ATTACH DATABASE 'other.db' AS other"],
  ["INSERT INTO compounds (name) VALUES ('x')"],
])('%s is refused', (sql) => {
  expect(() => runSql(database, sql)).toThrow(SqlError);
  expect(() => runSql(database, sql)).toThrow(/read-only/);
});

test('turning the read-only pragma off is refused too', () => {
  expect(() => runSql(database, 'PRAGMA query_only = 0')).toThrow(/read-only/);
  // And the data is still there.
  expect(runSql(database, 'SELECT COUNT(*) FROM compounds').rows[0]?.[0]).toBe(
    3,
  );
});

test('a reporting pragma is allowed', () => {
  const result = runSql(
    database,
    "SELECT name FROM pragma_table_info('compounds')",
  );
  expect(result.rows.map((row) => row[0])).toStrictEqual([
    'id',
    'name',
    'mass',
  ]);
});

test('a syntax error reads without the engine result code', () => {
  expect(() => runSql(database, 'SELEKT * FROM compounds')).toThrow(
    /near "SELEKT": syntax error/,
  );
  try {
    runSql(database, 'SELEKT * FROM compounds');
  } catch (error) {
    expect((error as Error).message).not.toMatch(/SQLITE_|result code/);
  }
});

test('an unknown column is named', () => {
  expect(() => runSql(database, 'SELECT nope FROM compounds')).toThrow(
    /no such column: nope/,
  );
});

test('an empty query says there is nothing to run', () => {
  expect(() => runSql(database, ' '.repeat(3))).toThrow(/no query to run/);
});
