import { HTMLTable, Tag } from '@blueprintjs/core';
import type { ReactElement } from 'react';
import { formatInteger } from 'react-cheminfo/core';
import { ClickToCopy } from 'react-cheminfo/ui';

import { SchemaDiagram } from '../components/SchemaDiagram.tsx';
import type { ColumnInfo, TableInfo } from '../data/schema.ts';
import { SCHEMA, SCHEMA_GROUPS, SCHEMA_STORY } from '../data/schema.ts';
import { sectionHref } from '../state/site.ts';

/**
 * The tables, their columns and the keys between them.
 *
 * The page opens on prose, then on the diagram, because the shape a student
 * has to hold in their head is one sentence long — a property belongs to a
 * listing, not to a substance — and the picture is what says it a second time.
 * @returns The page.
 */
export function Schema(): ReactElement {
  return (
    <div className="schema">
      <header className="schema__intro">
        <h1 className="page__title">The tables</h1>
        {SCHEMA_STORY.map((sentence) => (
          <p key={sentence} className="schema__story">
            {sentence}
          </p>
        ))}
      </header>

      <SchemaDiagram />

      {SCHEMA_GROUPS.map((group) => {
        const tables = SCHEMA.filter((table) => table.group === group.group);
        if (tables.length === 0) return null;
        return (
          <section key={group.group} className="schema__group">
            <h2 className="schema__group-title">{group.title}</h2>
            <p className="schema__group-blurb">{group.blurb}</p>
            {tables.map((table) => (
              <TableCard key={table.name} table={table} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function TableCard({ table }: { table: TableInfo }): ReactElement {
  return (
    <article className="schema__table" id={`table-${table.name}`}>
      <header className="schema__table-head">
        <h3 className="schema__table-name">
          <ClickToCopy value={table.name} label="table name">
            {table.name}
          </ClickToCopy>
        </h3>
        <Tag minimal className="schema__rows">
          {formatInteger(table.rowCount)} rows
        </Tag>
        {table.kind === 'view' ? (
          <Tag minimal intent="primary">
            view
          </Tag>
        ) : null}
      </header>
      <p className="schema__table-blurb">{table.blurb}</p>
      <div className="schema__columns">
        <HTMLTable compact striped>
          <thead>
            <tr>
              <th>Column</th>
              <th>Type</th>
              <th>Means</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((column) => (
              <ColumnRow key={column.name} column={column} />
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </article>
  );
}

function ColumnRow({ column }: { column: ColumnInfo }): ReactElement {
  return (
    <tr>
      <ClickToCopy
        as="td"
        className="schema__column-name"
        value={column.name}
        label="column name"
      >
        {column.name}
        {column.nullable ? null : (
          <span className="schema__required" title="never null" />
        )}
      </ClickToCopy>
      <td className="schema__column-type">{column.type}</td>
      <td>
        {column.description}
        {column.references ? (
          <>
            {' '}
            <a
              className="schema__reference"
              href={sectionHref(`table-${column.references.table}`)}
              title={`Points at ${column.references.table}.${column.references.column}`}
            >
              → {column.references.table}.{column.references.column}
            </a>
          </>
        ) : null}
      </td>
    </tr>
  );
}
