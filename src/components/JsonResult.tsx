import { Callout } from '@blueprintjs/core';
import type { ReactElement } from 'react';

export interface JsonResultProps {
  /** The documents a Mango query returned. */
  docs: Array<Record<string, unknown>>;
  /** How many matched before `limit` and `skip`. */
  matched: number;
  /** True when the cap cut the result short. */
  truncated: boolean;
  /** How long the query took. */
  elapsedMs: number;
}

/** A document longer than this is folded, so one big compound cannot fill the pane. */
const FOLD_AT = 1200;

/**
 * The documents a Mango query returned, as JSON.
 *
 * A document keeps its nesting here on purpose: seeing the arrays that SQL
 * spread over four tables sitting inside one object is the comparison the site
 * is built around.
 * @param props - The result to show.
 * @returns The JSON pane.
 */
export function JsonResult(props: JsonResultProps): ReactElement {
  const { docs, matched, truncated, elapsedMs } = props;

  if (docs.length === 0) {
    return (
      <Callout intent="none" className="result__empty">
        No document matched. A field that does not exist matches nothing — check
        the spelling against the schema, and remember that an array needs{' '}
        <code>$elemMatch</code>.
      </Callout>
    );
  }

  return (
    <div className="result">
      <p className="result__summary">
        {docs.length} {docs.length === 1 ? 'document' : 'documents'}
        {matched === docs.length ? '' : ` of ${matched} matched`}
        {truncated ? ' — more were left out' : ''} ·{' '}
        {elapsedMs.toFixed(elapsedMs < 10 ? 1 : 0)} ms
      </p>
      <div className="result__scroll">
        {docs.map((doc, index) => (
          <Document key={documentKey(doc, index)} doc={doc} />
        ))}
      </div>
    </div>
  );
}

/**
 * What a folded document is named in its summary line.
 *
 * A document is arbitrary JSON, so a field that happens to hold an object must
 * not end up printed as `[object Object]`.
 * @param doc - The document.
 * @returns Its name, its id, or the word document.
 */
function documentLabel(doc: Record<string, unknown>): string {
  for (const value of [doc.name, doc._id]) {
    if (typeof value === 'string' && value !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  return 'document';
}

function documentKey(doc: Record<string, unknown>, index: number): string {
  const id = doc._id;
  return typeof id === 'string' ? id : `doc-${index}`;
}

function Document({ doc }: { doc: Record<string, unknown> }): ReactElement {
  const text = JSON.stringify(doc, null, 2);
  if (text.length <= FOLD_AT) {
    return <pre className="json-doc">{text}</pre>;
  }
  return (
    <details className="json-doc json-doc--folded">
      <summary>
        {documentLabel(doc)} — {text.length.toLocaleString('en')} characters
      </summary>
      <pre>{text}</pre>
    </details>
  );
}
