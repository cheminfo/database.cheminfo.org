import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import { formatInteger, pluralize, toDelimited } from 'react-cheminfo/core';
import { ClickToCopy, CopyButton } from 'react-cheminfo/ui';
import { MF } from 'react-mf';

import type { SqlValue } from '../query/runSql.ts';

export interface ResultTableProps {
  /** The column names, in order. */
  columns: string[];
  /** The rows, already capped. */
  rows: SqlValue[][];
  /**
   * True when the cap cut the result short.
   * @default false
   */
  truncated?: boolean;
  /**
   * How long the query took.
   * @default undefined — no timing is printed
   */
  elapsedMs?: number;
  /**
   * How many rows matched before any cap, when that differs.
   * @default undefined
   */
  matched?: number;
}

/** Longer cell contents are cut; a click still copies the whole value. */
const MAX_CELL = 160;

/** Columns whose text is a molecular formula, drawn with sub- and superscripts. */
const FORMULA_COLUMNS = new Set(['formula', 'mf']);

/**
 * The rows a query produced, boxed the way `sqlite3` prints them in
 * `.mode box`, inside a `Terminal`.
 *
 * A JCAMP column holds two hundred kilobytes of numbers, so a cell is cut at a
 * readable length rather than laying the whole spectrum across the page.
 * @param props - The result to show.
 * @returns The table and a summary line.
 */
export function ResultTable(props: ResultTableProps): ReactElement {
  const { columns, rows, truncated = false, elapsedMs, matched } = props;
  // A result set has no identity of its own — two rows can be identical, and
  // `SELECT a, a` repeats a column name — so keys are built from the values and
  // disambiguated by how often each has been seen.
  const columnKeys = useMemo(() => disambiguate(columns), [columns]);
  const formulaColumns = useMemo(
    () => columns.map((column) => FORMULA_COLUMNS.has(column.toLowerCase())),
    [columns],
  );
  const rowKeys = useMemo(
    () => disambiguate(rows.map((row) => JSON.stringify(row))),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <p className="terminal__note result__empty">
        No rows matched. Widen the condition, or check a spelling.
      </p>
    );
  }

  return (
    <>
      <div className="terminal__scroll">
        <table className="terminal-table">
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
                  <ClickToCopy
                    key={columnKeys[cellIndex]}
                    as="td"
                    className={cellClass(cell)}
                    value={fullValue(cell)}
                    label={columns[cellIndex]}
                    disabled={cell === null || cell instanceof Uint8Array}
                  >
                    {renderCell(cell, formulaColumns[cellIndex] === true)}
                  </ClickToCopy>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="result__footer">
        <p className="terminal__status result__summary">
          {rows.length} {pluralize(rows.length, 'row')}
          {matched !== undefined && matched !== rows.length
            ? ` of ${matched} matched`
            : ''}
          {truncated ? ' — more were left out' : ''}
          {elapsedMs === undefined
            ? ''
            : ` · ${elapsedMs.toFixed(elapsedMs < 10 ? 1 : 0)} ms`}
        </p>
        <CopyButton
          className="result__copy"
          minimal
          small
          label="Copy as TSV"
          title="Copy the whole result as tab-separated values"
          content={() =>
            toDelimited(
              rows.map((row) => row.map(delimitedValue)),
              { header: columns },
            )
          }
        />
      </div>
    </>
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

function cellClass(value: SqlValue): string | undefined {
  if (value === null) return 'cell--null';
  if (typeof value === 'number' || typeof value === 'bigint') {
    return 'cell--number';
  }
  return undefined;
}

function fullValue(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (value instanceof Uint8Array) return `${value.byteLength} bytes`;
  return String(value);
}

/** A missing value and a blob are written out as an empty cell, not as prose. */
function delimitedValue(value: SqlValue): string {
  if (value === null || value instanceof Uint8Array) return '';
  return String(value);
}

function renderCell(value: SqlValue, isFormula: boolean): ReactNode {
  if (value === null) return 'NULL';
  if (value instanceof Uint8Array) return `⟨${value.byteLength} bytes⟩`;
  if (isFormula && typeof value === 'string') return <MF mf={value} />;
  const text = String(value);
  if (text.length <= MAX_CELL) return text;
  return `${text.slice(0, MAX_CELL)}… (${formatInteger(text.length)} characters)`;
}
