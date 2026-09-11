import { Callout, ProgressBar } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { PagePart } from 'react-cheminfo/ui';

import { JsonResult } from '../components/JsonResult.tsx';
import { QueryEditor } from '../components/QueryEditor.tsx';
import { ResultTable } from '../components/ResultTable.tsx';
import { TableList } from '../components/TableList.tsx';
import { useDatabase } from '../data/useDatabase.ts';
import type { MangoResult } from '../query/runMango.ts';
import { runMango } from '../query/runMango.ts';
import type { SqlResult } from '../query/runSql.ts';
import { runSql } from '../query/runSql.ts';
import { queries, rememberQueries } from '../state/queries.ts';

type Outcome<T> =
  { ok: true; value: T } | { ok: false; message: string } | null;

/**
 * The playground: one dataset, two languages, side by side.
 *
 * Both editors run against the same 541 compounds — the SQL side over the
 * tables, the Mango side over the same rows nested into one document each — so
 * the difference on screen is the difference between the two shapes, and
 * nothing else.
 * @returns The page.
 */
export function Playground(): ReactElement {
  useSignals();
  const database = useDatabase();
  const [sqlOutcome, setSqlOutcome] = useState<Outcome<SqlResult>>(null);
  const [mangoOutcome, setMangoOutcome] = useState<Outcome<MangoResult>>(null);

  const runSqlQuery = useCallback(() => {
    if (database.state !== 'ready') return;
    rememberQueries();
    try {
      setSqlOutcome({
        ok: true,
        value: runSql(database.database.database, queries.sql.value),
      });
    } catch (error) {
      setSqlOutcome({ ok: false, message: messageOf(error) });
    }
  }, [database]);

  const runMangoQuery = useCallback(() => {
    if (database.state !== 'ready') return;
    rememberQueries();
    let parsed: unknown;
    try {
      parsed = JSON.parse(queries.mango.value);
    } catch (error) {
      setMangoOutcome({
        ok: false,
        message: `That is not valid JSON, so it was not run: ${messageOf(error)}`,
      });
      return;
    }
    try {
      setMangoOutcome({
        ok: true,
        value: runMango(
          database.documents,
          parsed as Parameters<typeof runMango>[1],
        ),
      });
    } catch (error) {
      setMangoOutcome({ ok: false, message: messageOf(error) });
    }
  }, [database]);

  if (database.state === 'failed') {
    return (
      <Callout intent="danger" title="The database could not be loaded">
        {database.message} Reload the page to try again.
      </Callout>
    );
  }

  const loading = database.state === 'loading';

  return (
    <div className="playground">
      {loading ? (
        <DatabaseProgress received={database.received} total={database.total} />
      ) : null}

      <div className="playground__panes">
        <PagePart part="sql">
          <div className="playground__pane">
            <QueryEditor
              language="sql"
              title="SQL"
              value={queries.sql.value}
              onChange={(value) => {
                queries.sql.value = value;
              }}
              onRun={runSqlQuery}
              busy={loading}
            />
            <Outcome outcome={sqlOutcome}>
              {(result) => (
                <ResultTable
                  columns={result.columns}
                  rows={result.rows}
                  truncated={result.truncated}
                  elapsedMs={result.elapsedMs}
                />
              )}
            </Outcome>
          </div>
        </PagePart>

        <PagePart part="mango">
          <div className="playground__pane">
            <QueryEditor
              language="mango"
              title="Mango"
              value={queries.mango.value}
              onChange={(value) => {
                queries.mango.value = value;
              }}
              onRun={runMangoQuery}
              busy={loading}
            />
            <Outcome outcome={mangoOutcome}>
              {(result) => (
                <JsonResult
                  docs={result.docs}
                  matched={result.matched}
                  truncated={result.truncated}
                  elapsedMs={result.elapsedMs}
                />
              )}
            </Outcome>
          </div>
        </PagePart>
      </div>

      <PagePart part="schema">
        <TableList
          onPick={(sql) => {
            queries.sql.value = sql;
          }}
        />
      </PagePart>
    </div>
  );
}

function DatabaseProgress({
  received,
  total,
}: {
  received: number;
  total: number | null;
}): ReactElement {
  const megabytes = (received / 1e6).toFixed(1);
  const share = total === null ? undefined : Math.min(received / total, 1);
  return (
    <Callout
      intent="primary"
      className="playground__loading"
      title="Reading the database"
    >
      <p>
        {megabytes} MB
        {total === null ? '' : ` of ${(total / 1e6).toFixed(1)} MB`} — it
        downloads once, then runs in this tab with nothing sent back.
      </p>
      <ProgressBar
        value={share}
        intent="primary"
        stripes={share === undefined}
      />
    </Callout>
  );
}

function Outcome<T>({
  outcome,
  children,
}: {
  outcome: Outcome<T>;
  children: (value: T) => ReactElement;
}): ReactElement | null {
  if (outcome === null) return null;
  if (!outcome.ok) {
    return (
      <Callout intent="danger" className="result__error">
        {outcome.message}
      </Callout>
    );
  }
  return children(outcome.value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
