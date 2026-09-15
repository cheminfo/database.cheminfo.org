import { useEffect, useState } from 'react';

import { buildDocuments } from './buildDocuments.ts';
import type { LoadedDatabase } from './loadDatabase.ts';
import { loadDatabase } from './loadDatabase.ts';

export type DatabaseStatus =
  | { state: 'loading'; received: number; total: number | null }
  | { state: 'ready'; database: LoadedDatabase; documents: Array<Record<string, unknown>> }
  | { state: 'failed'; message: string };

let documentCache: Array<Record<string, unknown>> | undefined;

/**
 * The nested view of every compound, for the Mango side of the playground.
 *
 * Both halves of the page query the same 541 compounds; the tables and these
 * documents are two shapes of one dataset, which is the whole point of the
 * site. They are folded out of the tables once and kept.
 * @param loaded - The opened database.
 * @returns One document per compound.
 */
export function readDocuments(loaded: LoadedDatabase): Array<Record<string, unknown>> {
  documentCache ??= buildDocuments(loaded.database);
  return documentCache;
}

/**
 * Download and open the chemistry database, reporting progress while it lands.
 *
 * The page renders before the database does — 15 MB is a real download, and a
 * blank screen while it arrives would be worse than a bar that moves.
 * @returns What the database is doing right now.
 */
export function useDatabase(): DatabaseStatus {
  const [status, setStatus] = useState<DatabaseStatus>({
    state: 'loading',
    received: 0,
    total: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadDatabase({
      onProgress: ({ received, total }) => {
        if (!cancelled) setStatus({ state: 'loading', received, total });
      },
    })
      .then((database) => {
        if (cancelled) return;
        setStatus({ state: 'ready', database, documents: readDocuments(database) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({
          state: 'failed',
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
