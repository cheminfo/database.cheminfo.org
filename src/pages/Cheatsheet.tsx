import { HTMLTable } from '@blueprintjs/core';
import type { ReactElement } from 'react';

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
        {row.note ? <span className="cheatsheet__note">{row.note}</span> : null}
      </td>
      <td>
        <code className="cheatsheet__code">{row.sql}</code>
        {row.example?.sql ? (
          <pre className="cheatsheet__example">{row.example.sql}</pre>
        ) : null}
      </td>
      <td>
        {row.mango ? (
          <code className="cheatsheet__code">{row.mango}</code>
        ) : (
          <span className="cheatsheet__absent">no spelling</span>
        )}
        {row.example?.mango ? (
          <pre className="cheatsheet__example">{row.example.mango}</pre>
        ) : null}
      </td>
    </tr>
  );
}
