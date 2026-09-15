import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

import { buildDocuments } from '../buildDocuments.ts';
import { installReadOnlyAuthorizer } from '../loadDatabase.ts';

export interface ShippedDatabase {
  database: Database;
  documents: Array<Record<string, unknown>>;
}

/**
 * Open the database the site ships, exactly as the browser opens it.
 *
 * The content — tutorial steps, exercises, cheatsheet rows — is data, and every
 * query in it is checked against this. That is what stops the prose and the
 * database drifting apart the next time the harvest is re-run.
 * @returns The opened database and the documents the Mango side reads.
 */
export async function openShippedDatabase(): Promise<ShippedDatabase> {
  const sqlite3 = await sqlite3InitModule();
  const bytes = new Uint8Array(
    readFileSync(join(import.meta.dirname, '../../../public/chem.sqlite')),
  );
  const database = new sqlite3.oo1.DB();
  database.checkRc(
    sqlite3.capi.sqlite3_deserialize(
      database.pointer as number,
      'main',
      sqlite3.wasm.allocFromTypedArray(bytes),
      bytes.byteLength,
      bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
    ),
  );
  installReadOnlyAuthorizer(sqlite3, database);

  return { database, documents: buildDocuments(database) };
}
