import { Tooltip } from '@blueprintjs/core';
import type { ReactElement, ReactNode } from 'react';

import type { GlossaryEntry } from '../data/glossary.ts';
import { GLOSSARY } from '../data/glossary.ts';

export interface GlossaryTextProps {
  /** Prose carrying `[[term]]` markers and `` `code` `` spans. */
  children: string;
}

/**
 * Prose with every piece of jargon hoverable.
 *
 * A marker whose term is not in the glossary renders as plain words rather
 * than as brackets, so a step can be written before its entry exists and the
 * page never shows its own syntax.
 * @param props - The prose to render.
 * @returns The rendered prose.
 */
export function GlossaryText(props: GlossaryTextProps): ReactElement {
  return <>{render(props.children)}</>;
}

function render(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  for (const chunk of text.split(/(?<token>\[\[[^\]]+\]\]|`[^`]+`)/g)) {
    if (chunk === '') continue;
    if (chunk.startsWith('`') && chunk.endsWith('`')) {
      out.push(<code key={key++}>{chunk.slice(1, -1)}</code>);
      continue;
    }
    const term = /^\[\[(?<term>[^\]]+)\]\]$/.exec(chunk)?.groups?.term;
    if (term === undefined) {
      out.push(chunk);
      continue;
    }
    const entry = GLOSSARY[term.toLowerCase()];
    if (!entry) {
      out.push(term);
      continue;
    }
    out.push(
      <Tooltip
        key={key++}
        content={<GlossaryCard entry={entry} />}
        popoverClassName="glossary-popover"
        hoverOpenDelay={150}
        placement="top"
      >
        <span className="glossary-term">{term}</span>
      </Tooltip>,
    );
  }
  return out;
}

function GlossaryCard({ entry }: { entry: GlossaryEntry }): ReactElement {
  return (
    <div className="glossary-card">
      <p className="glossary-card__title">{entry.title}</p>
      <p className="glossary-card__summary">{entry.summary}</p>
      <ul className="glossary-card__examples">
        {entry.examples.map((example) => (
          <li key={example.code}>
            <code>{example.code}</code>
            {example.note ? (
              <span className="glossary-card__note">{example.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
