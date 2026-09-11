import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = 'https://www.chemexper.com';

/** Milliseconds to wait between requests, so the harvest stays a polite guest. */
export const DELAY_MS = 120;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL as JSON, retrying a few times on transport or 5xx failures.
 * @param url - Absolute URL to fetch.
 * @param options - Retry configuration.
 * @param options.attempts - How many times to try before giving up.
 * @returns The parsed body, or null when every attempt failed.
 */
export async function getJson(url, { attempts = 4 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(60_000),
      });
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      if (attempt === attempts) {
        process.stderr.write(`  ! ${url.slice(0, 90)} -> ${String(error)}\n`);
        return null;
      }
      await sleep(400 * attempt);
    }
  }
  return null;
}

/**
 * Fetch a URL as text, used for the JCAMP-DX payloads.
 * @param url - Absolute URL to fetch.
 * @returns The body, or null when the request failed.
 */
export async function getText(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Search ChemExper for entries carrying a given spectrum technique.
 * @param technique - `IR` or `NMR`.
 * @param smiles - Substructure query, written as SMILES.
 * @returns The search body, or null.
 */
export function searchByTechnique(technique, smiles) {
  const query = encodeURIComponent(smiles.replaceAll(/[/\\]/g, ''));
  return getJson(`${BASE}/search/reference/${technique}/json2/smiles/${query}`);
}

/**
 * Read the full record of one catalogue entry.
 * @param entryId - ChemExper entry identifier.
 * @returns The record, or null.
 */
export function entryDetails(entryId) {
  return getJson(`${BASE}/search/all/json2details/entry/${entryId}`);
}

/**
 * Build the URL of a stored JCAMP-DX file.
 * @param table - `ir` or `nmr`.
 * @param uniqueId - The spectrum identifier ChemExper stores it under.
 * @returns The absolute URL.
 */
export function jcampUrl(table, uniqueId) {
  return `${BASE}/cheminfo/servlet/org.dbcreator.MainServlet?action=SendFieldAction&tableName=${table}&fieldName=jcamp&uniqueIDValue=${uniqueId}`;
}

/**
 * Write a JSON file, creating its directory when needed.
 * @param path - Destination path.
 * @param value - Value to serialize.
 */
export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 1)}\n`);
}

/**
 * Read a JSON file.
 * @param path - Source path.
 * @returns The parsed contents.
 */
export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
