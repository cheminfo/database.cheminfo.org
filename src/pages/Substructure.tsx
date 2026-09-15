import { Button, Callout } from '@blueprintjs/core';
import { signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { Molecule } from 'openchemlib';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Structure, StructureEditor } from 'react-cheminfo/structure';

import { indexFragments } from '../chemistry/indexFragments.ts';
import { searchSubstructure } from '../chemistry/substructureSearch.ts';
import { IndexFragmentList } from '../components/IndexFragmentList.tsx';
import { IndexGrid } from '../components/IndexGrid.tsx';
import { SubstructureHits } from '../components/SubstructureHits.tsx';
import { useDatabase } from '../data/useDatabase.ts';

/** Queries worth opening on, each showing a different side of the index. */
const EXAMPLES = [
  { label: 'Benzene ring', smiles: 'c1ccccc1' },
  { label: 'Carboxylic acid', smiles: 'C(=O)[OH]' },
  { label: 'Bromine', smiles: 'Br' },
  { label: 'Phenol', smiles: 'c1ccccc1[OH]' },
] as const;

/**
 * The query, as an idCode. It lives in the query string, as the compound of
 * the browser does, so a link opens the structure it was made on.
 */
const queryIdCode = signal(readQuery());
/** Bumped to load an example into the editor, which is otherwise uncontrolled. */
const editorRevision = signal(0);

/**
 * Draw a fragment, see the 512-bit index it sets and the key fragments behind
 * every bit, then watch SQL screen the compounds on those bits before atoms are
 * compared.
 * @returns The page.
 */
export function Substructure(): ReactElement {
  useSignals();
  const database = useDatabase();
  const ready = database.state === 'ready' ? database.database.database : null;
  const idCode = queryIdCode.value;
  const [selectedBit, setSelectedBit] = useState<number | null>(null);

  const query = useMemo(() => readFragment(idCode), [idCode]);
  const fragments = useMemo(
    () => (query ? indexFragments(query) : []),
    [query],
  );
  const bits = useMemo(
    () => new Set(fragments.map((fragment) => fragment.bit)),
    [fragments],
  );
  const selected =
    fragments.find((fragment) => fragment.bit === selectedBit) ?? null;
  const result = useMemo(
    () => (ready && query ? searchSubstructure(ready, query) : null),
    [ready, query],
  );

  return (
    <div className="substructure">
      <header className="substructure__intro">
        <h1 className="page__title">Substructure search</h1>
        <p className="substructure__lead">
          OpenChemLib describes every structure with 512 yes-or-no questions,
          one per key fragment: an aromatic bond, a carbonyl, a bromine. The
          answers are its index, stored in <code>structures</code> as sixteen
          32-bit numbers, <code>index00</code> to <code>index15</code>. A query
          can only sit inside a structure that answers yes wherever the query
          does, so SQL screens with bitwise ANDs first, and atoms are compared
          only on the candidates left.
        </p>
      </header>

      <div className="substructure__examples">
        <span className="substructure__note">Start from</span>
        {EXAMPLES.map((example) => (
          <Button
            key={example.label}
            size="small"
            variant="outlined"
            text={example.label}
            onClick={() => {
              setQuery(fragmentIdCode(example.smiles));
              editorRevision.value += 1;
            }}
          />
        ))}
      </div>

      <div className="substructure__workbench">
        <section className="substructure__panel">
          <h2 className="substructure__heading">The query</h2>
          <StructureEditor
            fragment
            value={idCode}
            revision={editorRevision.value}
            minHeight={320}
            onChange={(change) => {
              setQuery(change.idCode.split(' ', 1)[0] ?? '');
            }}
          />
        </section>

        <section className="substructure__panel">
          <h2 className="substructure__heading">Its index</h2>
          <p className="substructure__note">
            {bits.size} of 512 bits set. Pick a bit, here or in the list below,
            to paint the key fragment that sets it.
          </p>
          <IndexGrid
            bits={bits}
            selected={selectedBit}
            onSelect={setSelectedBit}
          />
          {query ? (
            <figure className="substructure__figure">
              <Structure
                idCode={idCode}
                width={260}
                height={160}
                atomHighlight={selected ? selected.atoms.flat() : undefined}
                bondHighlight={selected ? selected.bonds.flat() : undefined}
              />
              <figcaption className="substructure__note">
                {selected
                  ? `Bit ${selected.bit} (index${String(selected.word).padStart(2, '0')} & ${selected.mask}): the key fragment matches ${selected.atoms.length} ${selected.atoms.length === 1 ? 'time' : 'times'}.`
                  : 'No bit picked.'}
              </figcaption>
            </figure>
          ) : null}
        </section>
      </div>

      <section className="substructure__section">
        <h2 className="substructure__heading">
          The key fragments behind those bits
        </h2>
        <IndexFragmentList
          fragments={fragments}
          selected={selectedBit}
          onSelect={setSelectedBit}
        />
      </section>

      {database.state === 'failed' ? (
        <Callout intent="danger" title="The database did not load">
          {database.message}
        </Callout>
      ) : null}
      {database.state === 'loading' ? (
        <Callout>Loading the database before the search can run…</Callout>
      ) : null}
      {result && query ? (
        <SubstructureHits result={result} query={query} />
      ) : null}
    </div>
  );
}

function fragmentIdCode(smiles: string): string {
  const molecule = Molecule.fromSmiles(smiles);
  molecule.setFragment(true);
  return molecule.getIDCode();
}

function readQuery(): string {
  const value = new URLSearchParams(globalThis.location?.search ?? '').get(
    'structure',
  );
  return value ?? fragmentIdCode(EXAMPLES[0].smiles);
}

function setQuery(idCode: string): void {
  queryIdCode.value = idCode;
  const search = new URLSearchParams(globalThis.location.search);
  search.set('structure', idCode);
  globalThis.history.replaceState(
    null,
    '',
    `${globalThis.location.pathname}?${search.toString()}`,
  );
}

function readFragment(idCode: string): Molecule | null {
  try {
    const molecule = Molecule.fromIDCode(idCode);
    molecule.setFragment(true);
    return molecule.getAllAtoms() > 0 ? molecule : null;
  } catch {
    return null;
  }
}
