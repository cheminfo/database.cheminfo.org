import { Button, Tag } from '@blueprintjs/core';
import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { useDatabase } from '../data/useDatabase.ts';

export interface TableListProps {
  /** Called with a ready-to-run query when a table is picked. */
  onPick: (sql: string) => void;
}

interface TableSummary {
  name: string;
  kind: 'table' | 'view';
  columns: string[];
  rows: number;
}

/**
 * Every table in the database, with its columns and how many rows it holds.
 *
 * The list is read from the database itself rather than written down beside
 * it, so it cannot drift from what a query will actually find.
 * @param props - What to do when a table is picked.
 * @returns The list.
 */
export function TableList(props: TableListProps): ReactElement | null {
  const database = useDatabase();
  const tables = useMemo(
    () =>
      database.state === 'ready' ? readTables(database.database.database) : [],
    [database],
  );

  if (tables.length === 0) return null;

  return (
    <section className="table-list" aria-label="Tables in this database">
      <h2 className="table-list__title">Tables</h2>
      <ul className="table-list__items">
        {tables.map((table) => (
          <li key={table.name} className="table-list__item">
            <Button
              variant="minimal"
              className="table-list__name"
              onClick={() =>
                props.onPick(`SELECT * FROM ${table.name} LIMIT 20;`)
              }
              title={`SELECT * FROM ${table.name} LIMIT 20;`}
            >
              {table.name}
            </Button>
            <Tag minimal className="table-list__count">
              {table.rows.toLocaleString('en')}
            </Tag>
            {table.kind === 'view' ? (
              <Tag minimal intent="primary">
                view
              </Tag>
            ) : null}
            <p className="table-list__columns">{table.columns.join(', ')}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function readTables(database: Database): TableSummary[] {
  const rows = collect(
    database,
    `SELECT name, type FROM sqlite_master
     WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
     ORDER BY type DESC, name`,
  );
  const tables: TableSummary[] = [];
  for (const [rawName, type] of rows) {
    const name = textOf(rawName);
    if (name === '') continue;
    const columns: string[] = [];
    for (const row of collect(
      database,
      `SELECT name FROM pragma_table_info('${name}')`,
    )) {
      const column = textOf(row[0]);
      if (column !== '') columns.push(column);
    }
    const count =
      collect(database, `SELECT COUNT(*) FROM "${name}"`)[0]?.[0] ?? 0;
    tables.push({
      name,
      kind: type === 'view' ? 'view' : 'table',
      columns,
      rows: Number(count),
    });
  }
  return tables;
}

/**
 * A column value SQLite hands back, when it is text.
 *
 * `sqlite_master.name` and `pragma_table_info.name` are always TEXT, but the
 * driver types every cell as the whole union — a blob included — and stringing
 * one of those would print `[object Uint8Array]` into the list.
 * @param value - The cell.
 * @returns The text, or an empty string when the cell is not text.
 */
function textOf(value: SqlValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

function collect(database: Database, sql: string): SqlValue[][] {
  const statement = database.prepare(sql);
  const rows: SqlValue[][] = [];
  try {
    while (statement.step()) rows.push(statement.get([]));
  } finally {
    statement.finalize();
  }
  return rows;
}
