/**
 * The two queries on screen, and the address that carries them.
 *
 * A link is how a lecturer hands out a question, so both editors keep their
 * text in the query string — `?sql=…&mango=…` — and reload from it. What the
 * visitor typed last also survives a closed tab, best-effort, in case they
 * opened the tool without a link.
 */

import { signal } from '@preact/signals-react';
import { persistBucket } from 'react-cheminfo/core';

/** The query each editor opens on when the address and the store say nothing. */
export const STARTING_SQL = `SELECT c.preferred_name AS name, c.formula, ROUND(s.molecular_weight, 2) AS mass
FROM compounds c
JOIN structures s ON s.compound_id = c.id
WHERE s.molecular_weight < 100
ORDER BY s.molecular_weight
LIMIT 20;`;

export const STARTING_MANGO = `{
  "selector": { "mass": { "$lt": 100 } },
  "fields": ["name", "formula", "mass"],
  "sort": [{ "mass": "asc" }],
  "limit": 20
}`;

/** The longest query an address may carry, so a link cannot be a payload. */
const MAX_QUERY_LENGTH = 8000;

const store = persistBucket<{ sql: string; mango: string }>({
  key: 'database:playground',
  defaults: { sql: STARTING_SQL, mango: STARTING_MANGO },
});

const initial = readInitial();

export const queries = {
  /** The SQL the left editor holds. */
  sql: signal(initial.sql),
  /** The Mango the right editor holds. */
  mango: signal(initial.mango),
};

/**
 * Write both queries into the address, so the link on screen reproduces it.
 *
 * `replaceState` rather than `pushState`: running a query is not a place, and
 * a student should not have to press Back nine times to leave the page.
 */
export function rememberQueries(): void {
  const search = new URLSearchParams(globalThis.location.search);
  setOrDelete(search, 'sql', queries.sql.value, STARTING_SQL);
  setOrDelete(search, 'mango', queries.mango.value, STARTING_MANGO);
  const query = decodeCommas(search.toString());
  globalThis.history.replaceState(
    null,
    '',
    query === ''
      ? globalThis.location.pathname
      : `${globalThis.location.pathname}?${query}`,
  );
  store.write({ sql: queries.sql.value, mango: queries.mango.value });
}

/**
 * Load a pair of queries into the editors — a tutorial step, an exercise.
 * @param next - What to put in each editor; an absent one is left alone.
 * @param next.sql - The SQL to load.
 * @param next.mango - The Mango to load.
 */
export function loadQueries(next: { sql?: string; mango?: string }): void {
  if (next.sql !== undefined) queries.sql.value = next.sql;
  if (next.mango !== undefined) queries.mango.value = next.mango;
}

function readInitial(): { sql: string; mango: string } {
  const stored = store.read().value;
  const search = new URLSearchParams(globalThis.location?.search ?? '');
  return {
    sql: clamp(search.get('sql')) ?? stored.sql,
    mango: clamp(search.get('mango')) ?? stored.mango,
  };
}

function clamp(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.slice(0, MAX_QUERY_LENGTH);
  return trimmed.trim() === '' ? undefined : trimmed;
}

function setOrDelete(
  search: URLSearchParams,
  key: string,
  value: string,
  fallback: string,
): void {
  // A parameter left at its default is deleted, never written, so an
  // unconfigured link stays a plain link.
  if (value.trim() === '' || value === fallback) search.delete(key);
  else search.set(key, value.slice(0, MAX_QUERY_LENGTH));
}

/** Commas parse the same either way, and a teacher has to read these links. */
function decodeCommas(query: string): string {
  return query.replaceAll('%2C', ',');
}
