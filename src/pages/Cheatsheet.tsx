import { HTMLTable } from '@blueprintjs/core';
import type { ReactElement } from 'react';

import { GlossaryText } from '../components/GlossaryText.tsx';
import { QueryCode } from '../components/QueryCode.tsx';
import type { CheatRow } from '../data/cheatsheet.ts';
import { CHEAT_SECTIONS } from '../data/cheatsheet.ts';

/**
 * SQL and Mango, side by side, on one printable page.
 *
 * Students print this. The chrome is dropped when they do, and the table is
 * laid out so a section is never split across a page boundary.
 * @returns The page.
 */
export function Cheatsheet(): ReactElement {
  return (
    <div className="cheatsheet">
      <header>
        <h1 className="page__title">SQL and Mango, side by side</h1>
        <p className="page__lead">
          Every example runs against this database. Where a row has no Mango
          spelling, the note says what to do instead.
        </p>
      </header>

      {CHEAT_SECTIONS.map((section) => (
        <section key={section.title} className="cheatsheet__section">
          <h2 className="cheatsheet__section-title">{section.title}</h2>
          <p className="cheatsheet__section-blurb">{section.blurb}</p>
          <HTMLTable compact striped className="cheatsheet__table">
            <thead>
              <tr>
                <th>To</th>
                <th>SQL</th>
                <th>Mango</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <Row key={`${section.title}-${row.concept}`} row={row} />
              ))}
            </tbody>
          </HTMLTable>
        </section>
      ))}
    </div>
  );
}

function Row({ row }: { row: CheatRow }): ReactElement {
  return (
    <tr>
      <td className="cheatsheet__concept">
        {row.concept}
        {row.note ? (
          <span className="cheatsheet__note">
            <GlossaryText>{row.note}</GlossaryText>
          </span>
        ) : null}
      </td>
      <td>
        <QueryCode
          code={row.sql}
          language="sql"
          tone="default"
          className="cheatsheet__code"
        />
        {row.example?.sql ? (
          <QueryCode
            code={row.example.sql}
            language="sql"
            format
            copyable
            className="cheatsheet__example"
          />
        ) : null}
      </td>
      <td>
        {row.mango ? (
          <QueryCode
            code={row.mango}
            language="mango"
            tone="default"
            className="cheatsheet__code"
          />
        ) : (
          <span className="cheatsheet__absent">no spelling</span>
        )}
        {row.example?.mango ? (
          <QueryCode
            code={row.example.mango}
            language="mango"
            format
            copyable
            className="cheatsheet__example"
          />
        ) : null}
      </td>
    </tr>
  );
}
