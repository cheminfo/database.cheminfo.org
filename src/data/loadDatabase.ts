import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

/**
 * Where the shipped database sits, beside the page's own mount.
 *
 * Resolved against the `<base>` rather than against the address open: every
 * routed address is served the same page, so a bare relative name would resolve
 * against `/exercises/…` and fetch the fallback HTML instead — which arrives as
 * a cheerful 200 and fails much later. The `<base>` is also what carries the
 * mount, so the one build finds its database on a host of its own and under a
 * path of a shared one alike.
 */
function databaseUrl(): string {
  const baseUri = globalThis.document?.baseURI;
  return baseUri ? new URL('chem.sqlite', baseUri).href : '/chem.sqlite';
}

export interface LoadedDatabase {
  /** The opened, read-only handle every query runs against. */
  database: Database;
  /** The runtime, kept for its constants. */
  sqlite3: Sqlite3Static;
  /** Bytes of the file that was downloaded. */
  bytes: number;
}

export interface LoadProgress {
  /** Bytes received so far. */
  received: number;
  /** Total bytes, when the server declared a length. */
  total: number | null;
}

let pending: Promise<LoadedDatabase> | undefined;

/**
 * Download the chemistry database and open it in WebAssembly.
 *
 * The file is deserialized into memory rather than mounted, so the page needs
 * no cross-origin isolation headers and nothing is written to the visitor's
 * disk. The handle is opened `query_only`, so a student's query cannot change
 * what the next visitor sees.
 * @param options - Loading options.
 * @param options.onProgress - Called as bytes arrive, for a progress bar.
 * @param options.url - Where to fetch the database from.
 * @returns The opened database, shared by every later call.
 */
export function loadDatabase(
  options: { onProgress?: (progress: LoadProgress) => void; url?: string } = {},
): Promise<LoadedDatabase> {
  pending ??= openDatabase(options);
  return pending;
}

/** Forget the opened database, so the next load starts again. Tests use this. */
export function resetDatabase(): void {
  pending = undefined;
}

async function openDatabase(options: {
  onProgress?: (progress: LoadProgress) => void;
  url?: string;
}): Promise<LoadedDatabase> {
  const [sqlite3, bytes] = await Promise.all([
    sqlite3InitModule(),
    download(options.url ?? databaseUrl(), options.onProgress),
  ]);

  const database = new sqlite3.oo1.DB();
  if (database.pointer === undefined) {
    throw new Error('SQLite could not create a database handle');
  }
  const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
  database.checkRc(
    sqlite3.capi.sqlite3_deserialize(
      database.pointer,
      'main',
      pointer,
      bytes.byteLength,
      bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
    ),
  );
  installReadOnlyAuthorizer(sqlite3, database);

  return { database, sqlite3, bytes: bytes.byteLength };
}

/** The pragmas that only report, and are safe for a visitor to run. */
const READABLE_PRAGMAS = new Set([
  'collation_list', 'compile_options', 'database_list', 'encoding', 'foreign_key_list',
  'freelist_count', 'function_list', 'index_info', 'index_list', 'integrity_check',
  'page_count', 'page_size', 'pragma_list', 'quick_check', 'table_info', 'table_list',
  'table_xinfo', 'user_version',
]);

/**
 * Refuse every statement that is not a read.
 *
 * `PRAGMA query_only = 1` is not enough on its own: a visitor can turn it back
 * off with `PRAGMA query_only = 0` and then drop a table, which would leave the
 * rest of the session querying a database that no longer matches what anyone
 * else sees. An authorizer cannot be switched off from SQL.
 * @param sqlite3 - The runtime.
 * @param database - The handle to protect.
 */
export function installReadOnlyAuthorizer(sqlite3: Sqlite3Static, database: Database): void {
  const capi = sqlite3.capi;
  const handle = database.pointer;
  if (handle === undefined) {
    throw new Error('SQLite cannot protect a database that is already closed');
  }
  const allowed = new Set<number>([
    capi.SQLITE_SELECT,
    capi.SQLITE_READ,
    capi.SQLITE_FUNCTION,
    capi.SQLITE_RECURSIVE,
  ]);
  const authorize = (
    _userData: number,
    action: number,
    first: string | 0,
  ): number => {
    if (allowed.has(action)) return capi.SQLITE_OK;
    if (action === capi.SQLITE_PRAGMA) {
      return READABLE_PRAGMAS.has((first || '').toLowerCase())
        ? capi.SQLITE_OK
        : capi.SQLITE_DENY;
    }
    return capi.SQLITE_DENY;
  };
  const rc = capi.sqlite3_set_authorizer(handle, authorize, 0);
  if (rc !== capi.SQLITE_OK) {
    throw new Error(`SQLite refused the read-only authorizer (code ${rc})`);
  }
}

/** Every SQLite file starts with these bytes. */
const MAGIC = 'SQLite format 3\0';

/**
 * Fail loudly when what arrived is not a database.
 *
 * A single-page site answers every unknown address with its own HTML, so a
 * mistyped or mis-resolved path returns 200 and a page. Opening that as a
 * database fails deep inside WebAssembly with nothing a reader can act on.
 * @param bytes - What was downloaded.
 * @param url - Where it came from, for the message.
 */
function assertIsDatabase(bytes: Uint8Array, url: string): void {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, MAGIC.length));
  if (header === MAGIC) return;
  const looksLikeHtml = /^\s*<(?:!doctype|html)/i.test(
    new TextDecoder('latin1').decode(bytes.subarray(0, 64)),
  );
  throw new Error(
    looksLikeHtml
      ? `${url} answered with a web page rather than the database. The file is missing from the server.`
      : `${url} is not a SQLite database (it starts with ${JSON.stringify(header)}).`,
  );
}

async function download(
  url: string,
  onProgress?: (progress: LoadProgress) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The database could not be downloaded (HTTP ${response.status})`);
  }
  const declared = response.headers.get('content-length');
  const total = declared === null ? null : Number(declared);

  if (!response.body || !onProgress) {
    const whole = new Uint8Array(await response.arrayBuffer());
    assertIsDatabase(whole, url);
    return whole;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    // Chunks arrive in order; reading them concurrently is not an option.
    // eslint-disable-next-line no-await-in-loop -- a stream is read one chunk at a time
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ received, total });
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  assertIsDatabase(bytes, url);
  return bytes;
}
