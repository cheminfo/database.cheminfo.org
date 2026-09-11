import { Callout } from '@blueprintjs/core';
import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { useEffect, useMemo } from 'react';

import { CompoundDetail } from '../components/CompoundDetail.tsx';
import { CompoundList } from '../components/CompoundList.tsx';
import { readCompound, readCompounds } from '../data/readCompound.ts';
import { useDatabase } from '../data/useDatabase.ts';

/**
 * Every row of the database, laid out so it can be checked by eye.
 *
 * This is the page to open when something looks wrong: it shows one compound
 * with all of its names, all of its listings and their claims, and both
 * spectra drawn from the JCAMP-DX the database actually carries — not from a
 * summary of it.
 * @returns The page.
 */
/**
 * Which compound is open. It lives in the query string rather than in the path
 * because it is tool input, not a page: one address, one prerendered file, and
 * a link that still opens the compound it names.
 */
const selectedCompound = signal<number | null>(readSelected());

function readSelected(): number | null {
  const value = new URLSearchParams(globalThis.location?.search ?? '').get(
    'compound',
  );
  if (value === null) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function selectCompound(id: number): void {
  selectedCompound.value = id;
  const search = new URLSearchParams(globalThis.location.search);
  search.set('compound', String(id));
  globalThis.history.replaceState(
    null,
    '',
    `${globalThis.location.pathname}?${search.toString()}`,
  );
}

export function Browse(): ReactElement {
  useSignals();
  const database = useDatabase();
  const ready = database.state === 'ready' ? database.database.database : null;

  const compounds = useMemo(() => (ready ? readCompounds(ready) : []), [ready]);
  const selectedId = selectedCompound.value;
  const selected = useMemo(
    () =>
      ready && selectedId !== null ? readCompound(ready, selectedId) : null,
    [ready, selectedId],
  );

  // The browser's own back button changes the address without a React event.
  useEffect(() => {
    const sync = (): void => {
      selectedCompound.value = readSelected();
    };
    globalThis.addEventListener('popstate', sync);
    return () => globalThis.removeEventListener('popstate', sync);
  }, []);

  if (database.state === 'failed') {
    return (
      <Callout intent="danger" title="The database could not be loaded">
        {database.message}
      </Callout>
    );
  }

  return (
    <div className="browse">
      <header className="browse__head">
        <h1 className="page__title">Browse the data</h1>
        <p className="page__lead">
          One compound at a time, with everything that points at it — and both
          spectra drawn from the JCAMP-DX the database stores.
        </p>
      </header>

      <div className="browse__body">
        {compounds.length === 0 ? (
          <Callout className="browse__loading">Reading the database…</Callout>
        ) : (
          <CompoundList
            compounds={compounds}
            selectedId={selectedId}
            onSelect={(compound) => selectCompound(compound.id)}
          />
        )}

        {selected ? (
          <CompoundDetail compound={selected} />
        ) : (
          <Callout className="browse__pick">
            Pick a compound, or move through them with the arrow keys.
          </Callout>
        )}
      </div>
    </div>
  );
}
