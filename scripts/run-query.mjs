/**
 * Run a SQL or a Mango query against the shipped database, from the terminal.
 *
 * Content is written as data — tutorial steps, exercises, cheatsheet rows — and
 * every query in it must actually return what it claims. This is what checks
 * that, using the same two engines the browser uses.
 *
 *   node scripts/run-query.mjs sql "SELECT ..."
 *   node scripts/run-query.mjs mango '{"selector":{"charge":0},"limit":3}'
 *   node scripts/run-query.mjs file queries.json   # [{kind, query}, ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const ROOT = join(import.meta.dirname, '..');
const { runSql } = await import(join(ROOT, 'src/query/runSql.ts'));
const { runMango } = await import(join(ROOT, 'src/query/runMango.ts'));
const { installReadOnlyAuthorizer } = await import(join(ROOT, 'src/data/loadDatabase.ts'));
const { buildDocuments } = await import(join(ROOT, 'src/data/buildDocuments.ts'));

const sqlite3 = await sqlite3InitModule();
const bytes = new Uint8Array(readFileSync(join(ROOT, 'public/chem.sqlite')));
const database = new sqlite3.oo1.DB();
database.checkRc(
  sqlite3.capi.sqlite3_deserialize(
    database.pointer,
    'main',
    sqlite3.wasm.allocFromTypedArray(bytes),
    bytes.byteLength,
    bytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
  ),
);
installReadOnlyAuthorizer(sqlite3, database);

let documents;
function getDocuments() {
  documents ??= buildDocuments(database);
  return documents;
}

/**
 * Run one query and describe what came back.
 * @param kind - `sql` or `mango`.
 * @param query - The statement, or the Mango query as JSON text.
 * @returns A short report.
 */
export function check(kind, query) {
  if (kind === 'sql') {
    const result = runSql(database, query, { maxRows: 50 });
    return {
      ok: true,
      rows: result.rows.length,
      columns: result.columns,
      elapsedMs: Number(result.elapsedMs.toFixed(2)),
      sample: result.rows.slice(0, 5),
    };
  }
  const parsed = typeof query === 'string' ? JSON.parse(query) : query;
  const result = runMango(getDocuments(), parsed, { maxDocuments: 50 });
  return {
    ok: true,
    matched: result.matched,
    rows: result.docs.length,
    elapsedMs: Number(result.elapsedMs.toFixed(2)),
    sample: result.docs.slice(0, 3),
  };
}

const [kind, argument] = process.argv.slice(2);
if (kind === 'file') {
  const cases = JSON.parse(readFileSync(argument, 'utf8'));
  let failed = 0;
  for (const [index, item] of cases.entries()) {
    try {
      const report = check(item.kind, item.query);
      process.stdout.write(
        `${String(index).padStart(3)} ${item.kind.padEnd(5)} ok  rows=${report.rows} ${item.kind === 'mango' ? `matched=${report.matched}` : `cols=${report.columns.join(',')}`} ${report.elapsedMs}ms  ${item.label ?? ''}\n`,
      );
    } catch (error) {
      failed++;
      process.stdout.write(`${String(index).padStart(3)} ${item.kind.padEnd(5)} FAIL ${item.label ?? ''}\n     ${String(error.message)}\n`);
    }
  }
  process.stdout.write(`\n${cases.length - failed}/${cases.length} queries ran\n`);
  process.exitCode = failed === 0 ? 0 : 1;
} else if (kind) {
  try {
    process.stdout.write(`${JSON.stringify(check(kind, argument), null, 1)}\n`);
  } catch (error) {
    process.stdout.write(`FAILED: ${error.message}\n`);
    process.exitCode = 1;
  }
}
database.close();
