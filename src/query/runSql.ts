import type { Database } from '@sqlite.org/sqlite-wasm';

/** Rows beyond this are not collected; the grid cannot show them anyway. */
export const MAX_ROWS = 2000;

/** A query that has not finished by then is stopped and reported as such. */
export const TIME_LIMIT_MS = 5000;

export type SqlValue = string | number | bigint | Uint8Array | null;

export interface SqlResult {
  /** The column names, in the order the query asked for them. */
  columns: string[];
  /** The rows, capped at `MAX_ROWS`. */
  rows: SqlValue[][];
  /** True when the query had more rows than the cap allowed. */
  truncated: boolean;
  /** How long the query took, in milliseconds. */
  elapsedMs: number;
}

export class SqlError extends Error {
  /** The offset the engine complained about, when it names one. */
  readonly offset: number | null;

  constructor(message: string, offset: number | null = null) {
    super(message);
    this.name = 'SqlError';
    this.offset = offset;
  }
}

/**
 * Run one SQL statement and collect its rows.
 *
 * The database is opened `query_only`, so a statement that writes fails in the
 * engine rather than here. What this adds is a row cap and a deadline, because
 * a student will write a cartesian join sooner or later and the page has to
 * survive it.
 * @param database - The opened database.
 * @param sql - The statement to run.
 * @param options - Limits.
 * @param options.maxRows - Rows to collect before stopping.
 * @param options.timeLimitMs - How long the query may run.
 * @returns The columns and rows the statement produced.
 */
export function runSql(
  database: Database,
  sql: string,
  options: { maxRows?: number; timeLimitMs?: number } = {},
): SqlResult {
  const maxRows = options.maxRows ?? MAX_ROWS;
  const timeLimitMs = options.timeLimitMs ?? TIME_LIMIT_MS;
  const trimmed = sql.trim();
  if (trimmed === '') {
    throw new SqlError('There is no query to run yet.');
  }

  const started = performance.now();
  let statement;
  try {
    statement = database.prepare(trimmed);
  } catch (error) {
    throw asSqlError(error);
  }

  try {
    const columns: string[] = statement.getColumnNames();
    if (columns.length === 0) {
      // A statement that returns nothing is a write, and writes do not run
      // here — but step it once so the engine says so in its own words.
      statement.step();
      throw new SqlError(
        'This database is read-only. INSERT, UPDATE, DELETE, CREATE and DROP do not run here — every question can be asked with SELECT.',
      );
    }
    const rows: SqlValue[][] = [];
    let truncated = false;
    let checked = 0;

    while (statement.step()) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(statement.get([]) as SqlValue[]);
      // Reading the clock on every row of a fast query costs more than the
      // query; every few hundred rows is soon enough to stop a runaway one.
      checked++;
      if (checked % 256 === 0 && performance.now() - started > timeLimitMs) {
        throw new SqlError(
          `The query was stopped after ${(timeLimitMs / 1000).toFixed(0)} seconds. Add a WHERE, or a LIMIT, and try again.`,
        );
      }
    }

    return { columns, rows, truncated, elapsedMs: performance.now() - started };
  } catch (error) {
    throw asSqlError(error);
  } finally {
    statement.finalize();
  }
}

/**
 * Turn whatever the engine threw into a message a student can act on.
 * @param error - The thrown value.
 * @returns A `SqlError` carrying a readable message.
 */
function asSqlError(error: unknown): SqlError {
  if (error instanceof SqlError) return error;
  const raw = error instanceof Error ? error.message : String(error);
  // The engine prefixes its own result code, which means nothing to a reader.
  const message = raw
    .replace(/^SQLITE_[A-Z]+:\s*/, '')
    .replace(/^sqlite3 result code \d+:\s*/, '')
    .trim();
  if (
    /attempt to write a readonly database|not authorized|SQLITE_AUTH/i.test(
      message,
    )
  ) {
    return new SqlError(
      'This database is read-only. INSERT, UPDATE, DELETE, CREATE and DROP do not run here — every question can be asked with SELECT.',
    );
  }
  return new SqlError(message === '' ? 'The query could not be run.' : message);
}
