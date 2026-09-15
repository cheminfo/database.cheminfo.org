import type { Molecule } from 'openchemlib';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import {
  formatDecimal,
  formatInteger,
  formatQueryString,
  pluralize,
} from 'react-cheminfo/core';
import { Structure } from 'react-cheminfo/structure';
import { CodeBlock } from 'react-cheminfo/ui';

import type {
  SubstructureHit,
  SubstructureSearchResult,
} from '../chemistry/substructureSearch.ts';
import { firstMatch } from '../chemistry/substructureSearch.ts';

/** Hits drawn at once; the count above them is always the whole set. */
const SHOWN = 48;

export interface SubstructureHitsProps {
  /** What the two steps of the search found. */
  result: SubstructureSearchResult;
  /** The query, painted on every hit where it matches. */
  query: Molecule;
}

/**
 * The two steps of a substructure search, told as a funnel: how many
 * structures the SQL screen keeps, how many really contain the query, the SQL
 * itself, and the hits with the query painted on them.
 * @param props - The search result and its query.
 * @returns The section.
 */
export function SubstructureHits(props: SubstructureHitsProps): ReactElement {
  const { result, query } = props;
  const { screened, hits, screeningSql, screeningMs, verificationMs } = result;
  const rejected = screened - hits.length;
  const playground = `/?${formatQueryString({ sql: screeningSql })}`;

  return (
    <section className="substructure__section">
      <h2 className="substructure__heading">What the search finds</h2>
      <p className="substructure__funnel">
        <strong>{formatInteger(screened)}</strong>{' '}
        {pluralize(screened, 'structure holds', 'structures hold')} every bit of
        the query, screened in SQL in {formatDecimal(screeningMs, 1)} ms.
        Comparing atoms keeps <strong>{formatInteger(hits.length)}</strong> of
        them, in {formatDecimal(verificationMs, 1)} ms
        {rejected > 0
          ? `; the other ${formatInteger(rejected)} set the same bits without containing the query.`
          : '.'}
      </p>
      <CodeBlock code={screeningSql} tone="muted" copyable />
      <p className="substructure__note">
        <a href={playground}>Run this screen in the playground</a>
      </p>
      <ul className="substructure__hits">
        {hits.slice(0, SHOWN).map((hit) => (
          <HitCard key={hit.compoundId} hit={hit} query={query} />
        ))}
      </ul>
      {hits.length > SHOWN ? (
        <p className="substructure__note">
          and {formatInteger(hits.length - SHOWN)} more
        </p>
      ) : null}
    </section>
  );
}

function HitCard(props: {
  hit: SubstructureHit;
  query: Molecule;
}): ReactElement {
  const { hit, query } = props;
  const { idCode, compoundId, name } = hit;
  const match = useMemo(() => firstMatch(idCode, query), [idCode, query]);
  return (
    <li className="substructure__hit">
      <Structure
        idCode={idCode}
        width={150}
        height={110}
        atomHighlight={match.atoms}
        bondHighlight={match.bonds}
      />
      <a href={`/browse?compound=${compoundId}`}>
        {name ?? `compound ${compoundId}`}
      </a>
    </li>
  );
}
