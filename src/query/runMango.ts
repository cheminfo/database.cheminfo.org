import {
  createFieldSorter,
  getFieldFromDoc,
  massageSelector,
  matchesSelector,
  parseField,
} from 'pouchdb-selector-core';

/** Documents beyond this are not returned. */
export const MAX_DOCUMENTS = 2000;

export interface MangoQuery {
  /** The condition every returned document satisfies. */
  selector?: Record<string, unknown>;
  /** The fields to keep, dotted paths included. All of them when absent. */
  fields?: string[];
  /** The order to return them in. */
  sort?: Array<string | Record<string, 'asc' | 'desc'>>;
  /** How many documents to return. */
  limit?: number;
  /** How many to step over first. */
  skip?: number;
}

export interface MangoResult {
  /** The matching documents, projected and ordered as asked. */
  docs: Array<Record<string, unknown>>;
  /** How many documents matched before `limit` and `skip` were applied. */
  matched: number;
  /** True when the cap cut the result short. */
  truncated: boolean;
  /** How long the query took, in milliseconds. */
  elapsedMs: number;
}

export class MangoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MangoError';
  }
}

/** Operators CouchDB accepts but this engine does not implement. */
const UNSUPPORTED = new Set(['$keyMapMatch', '$text']);

/**
 * Run a Mango query over an array of documents.
 *
 * This is CouchDB's own selector engine, the one PouchDB ships, so a selector
 * that works here works against a real CouchDB. What is missing is everything
 * a server provides and a page cannot: indexes, bookmarks, execution stats.
 * @param documents - The documents to query.
 * @param query - The Mango query.
 * @param options - Limits.
 * @param options.maxDocuments - Documents to return before stopping.
 * @returns The matching documents.
 */
export function runMango(
  documents: ReadonlyArray<Record<string, unknown>>,
  query: MangoQuery,
  options: { maxDocuments?: number } = {},
): MangoResult {
  const maxDocuments = options.maxDocuments ?? MAX_DOCUMENTS;
  const started = performance.now();

  const selector = query.selector ?? {};
  if (typeof selector !== 'object' || Array.isArray(selector)) {
    throw new MangoError(
      '`selector` must be an object, for example {"mass": {"$lt": 100}}.',
    );
  }
  for (const operator of findOperators(selector)) {
    if (UNSUPPORTED.has(operator)) {
      throw new MangoError(
        `\`${operator}\` is part of CouchDB but is not implemented in the browser, so this query cannot run here.`,
      );
    }
  }

  const sort = normalizeSort(query.sort);

  let massaged: Record<string, unknown>;
  try {
    massaged = massageSelector(
      deepMassage(structuredClone(selector)) as Record<string, unknown>,
    );
  } catch (error) {
    throw new MangoError(readable(error));
  }

  checkRegexes(selector);

  let matched: Array<Record<string, unknown>>;
  try {
    matched = documents.filter((doc) => matchesSelector(doc, massaged));
  } catch (error) {
    throw new MangoError(readable(error));
  }

  if (sort) {
    const sorter = createFieldSorter(sort);
    matched = matched
      .map((doc) => ({ doc }))
      .toSorted(sorter)
      .map((row) => row.doc);
    if (
      typeof sort[0] !== 'string' &&
      Object.values(sort[0] as object)[0] === 'desc'
    ) {
      matched.reverse();
    }
  }

  const total = matched.length;
  const skip = clampInteger(query.skip, 0, 0, total);
  const limit = clampInteger(query.limit, maxDocuments, 0, maxDocuments);
  const window = matched.slice(skip, skip + limit);

  const docs = query.fields?.length
    ? window.map((doc) => project(doc, query.fields as string[]))
    : window.map((doc) => structuredClone(doc));

  return {
    docs,
    matched: total,
    truncated: total - skip > window.length,
    elapsedMs: performance.now() - started,
  };
}

/**
 * Normalize the sub-selector every `$elemMatch` and `$allMatch` carries.
 *
 * The engine normalizes the selector it is handed but does not recurse into an
 * element matcher, so a `$and` written inside one arrives in its raw shape and
 * the matcher dies on it — `$and` inside `$elemMatch` is ordinary CouchDB, and
 * a student who writes it deserves an answer rather than an internal error.
 * @param value - Any part of the selector.
 * @returns The same selector with every sub-selector normalized.
 */
function deepMassage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => deepMassage(item));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] =
      key === '$elemMatch' || key === '$allMatch'
        ? massageSelector(deepMassage(child) as Record<string, unknown>)
        : deepMassage(child);
  }
  return out;
}

/**
 * Bring a `sort` to the one shape the sorter understands.
 *
 * A bare `["mass"]` is valid Mango, but the sorter reads it with
 * `Object.keys('mass')[0]` and silently sorts on a field called `0`, so it is
 * rewritten. Mixed directions are refused, as CouchDB refuses them.
 * @param sort - The sort as written.
 * @returns The normalized sort, or undefined when there is none.
 */
function normalizeSort(
  sort: MangoQuery['sort'],
): Array<Record<string, 'asc' | 'desc'>> | undefined {
  if (!sort || sort.length === 0) return undefined;
  const normalized = sort.map((item) => {
    if (typeof item === 'string') return { [item]: 'asc' as const };
    const [field, direction] = Object.entries(item)[0] ?? [];
    if (!field) throw new MangoError('Each `sort` entry names one field.');
    if (direction !== 'asc' && direction !== 'desc') {
      throw new MangoError(
        `\`sort\` takes "asc" or "desc", not ${JSON.stringify(direction)}.`,
      );
    }
    return { [field]: direction };
  });
  const directions = new Set(normalized.map((item) => Object.values(item)[0]));
  if (directions.size > 1) {
    throw new MangoError(
      'Every field in `sort` must run the same way — CouchDB does not mix "asc" and "desc".',
    );
  }
  return normalized;
}

/**
 * Keep only the asked-for fields, dotted paths included.
 * @param doc - The document.
 * @param fields - The paths to keep.
 * @returns A new document holding those paths.
 */
function project(
  doc: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const path = parseField(field);
    const value = getFieldFromDoc(doc, path);
    if (value === undefined) continue;
    let target = out;
    for (const key of path.slice(0, -1)) {
      target[key] ??= {};
      target = target[key] as Record<string, unknown>;
    }
    target[path.at(-1) as string] = structuredClone(value);
  }
  return out;
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}

/**
 * Reject a `$regex` the browser cannot compile.
 *
 * CouchDB runs Go's regexp, which takes inline flags like `(?i)`; a browser
 * runs JavaScript's, which does not, and throws a message about an invalid
 * group that says nothing about why.
 * @param value - Any part of the selector.
 */
function checkRegexes(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) checkRegexes(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$regex' && typeof child === 'string') {
      const inline = /^\(\?[a-zA-Z]+\)/.exec(child);
      if (inline) {
        throw new MangoError(
          `The browser's regular expressions do not take an inline flag like \`${inline[0]}\`. Write the pattern without it — for a case-insensitive match, spell both cases, as in [Ee]thyl.`,
        );
      }
      try {
        // Compiling is the whole check: an invalid pattern throws here, where
        // the message can still name it.
        void new RegExp(child);
      } catch (error) {
        throw new MangoError(
          `\`$regex\` could not be compiled: ${readable(error)}`,
        );
      }
      continue;
    }
    checkRegexes(child);
  }
}

function findOperators(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) findOperators(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$')) found.add(key);
      findOperators(child, found);
    }
  }
  return found;
}

function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() === '' ? 'The query could not be run.' : message;
}
