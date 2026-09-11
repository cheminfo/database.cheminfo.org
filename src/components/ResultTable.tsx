import { Callout, HTMLTable } from '@blueprintjs/core';
import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';

import type { SqlValue } from '../query/runSql.ts';

export interface ResultTableProps {
  /** The column names, in order. */
  columns: string[];
  /** The rows, already capped. */
  rows: SqlValue[][];
  /** True when the cap cut the result short. */
  truncated?: boolean;
  /** How long the query took. */
  elapsedMs?: number;
  /** How many rows matched before any cap, when that differs. */
  matched?: number;
}

/** Longer cell contents are cut, with the full value kept in the tooltip. */
const MAX_CELL = 160;

/**
 * The rows a query produced.
 *
 * A JCAMP column holds two hundred kilobytes of numbers, so a cell is cut at a
 * readable length rather than laying the whole spectrum across the page.
 * @param props - The result to show.
 * @returns The table.
 */
export function ResultTable(props: ResultTableProps): ReactElement {
  const { columns, rows, truncated = false, elapsedMs, matched } = props;
  // A result set has no identity of its own — two rows can be identical, and
  // `SELECT a, a` repeats a column name — so keys are built from the values and
  // disambiguated by how often each has been seen.
  const columnKeys = useMemo(() => disambiguate(columns), [columns]);
  const rowKeys = useMemo(
    () => disambiguate(rows.map((row) => JSON.stringify(row))),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <Callout intent="none" className="result__empty">
        No rows matched. Widen the condition, or check a spelling.
      </Callout>
    );
  }

  return (
    <div className="result">
      <p className="result__summary">
        {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        {matched !== undefined && matched !== rows.length
          ? ` of ${matched} matched`
          : ''}
        {truncated ? ' — more were left out' : ''}
        {elapsedMs === undefined
          ? ''
          : ` · ${elapsedMs.toFixed(elapsedMs < 10 ? 1 : 0)} ms`}
      </p>
      <div className="result__scroll">
        <HTMLTable compact striped interactive={false}>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={columnKeys[index]}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowKeys[rowIndex]}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={columnKeys[cellIndex]}
                    className={cellClass(cell)}
                    title={fullValue(cell)}
                  >
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </div>
  );
}

/**
 * Make a list of strings unique, keeping the order they came in.
 * @param values - The strings, which may repeat.
 * @returns One key per input, unique across the list.
 */
function disambiguate(values: string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const count = seen.get(value) ?? 0;
    seen.set(value, count + 1);
    return count === 0 ? value : `${value}#${count}`;
  });
}

function cellClass(value: SqlValue): string {
  if (value === null) return 'cell cell--null';
  if (typeof value === 'number' || typeof value === 'bigint') {
    return 'cell cell--number';
  }
  return 'cell';
}

function fullValue(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (value instanceof Uint8Array) return `${value.byteLength} bytes`;
  return String(value);
}

function renderCell(value: SqlValue): ReactNode {
  if (value === null) return <span className="cell__null">NULL</span>;
  if (value instanceof Uint8Array) return `⟨${value.byteLength} bytes⟩`;
  const text = String(value);
  if (text.length <= MAX_CELL) return text;
  return `${text.slice(0, MAX_CELL)}… (${text.length.toLocaleString('en')} characters)`;
}
