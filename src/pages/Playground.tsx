import { Callout, ProgressBar } from '@blueprintjs/core';
import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { formatBytes } from 'react-cheminfo/core';
import { PagePart } from 'react-cheminfo/ui';

import { JsonResult } from '../components/JsonResult.tsx';
import { QueryEditor } from '../components/QueryEditor.tsx';
import { ResultTable } from '../components/ResultTable.tsx';
import { TableList } from '../components/TableList.tsx';
import { Terminal } from '../components/Terminal.tsx';
import { useDatabase } from '../data/useDatabase.ts';
import type { QueryLanguage } from '../query/queryCode.ts';
import type { MangoResult } from '../query/runMango.ts';
import { runMango } from '../query/runMango.ts';
import type { SqlResult } from '../query/runSql.ts';
import { runSql } from '../query/runSql.ts';
import { queries, rememberQueries } from '../state/queries.ts';

type Outcome<T> =
  | { ok: true; query: string; value: T }
  | { ok: false; query: string; message: string }
  | null;

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
    const query = queries.sql.value;
    try {
      setSqlOutcome({
        ok: true,
        query,
        value: runSql(database.database.database, query),
      });
    } catch (error) {
      setSqlOutcome({ ok: false, query, message: messageOf(error) });
    }
  }, [database]);

  const runMangoQuery = useCallback(() => {
    if (database.state !== 'ready') return;
    rememberQueries();
    const query = queries.mango.value;
    let parsed: unknown;
    try {
      parsed = JSON.parse(query);
    } catch (error) {
      setMangoOutcome({
        ok: false,
        query,
        message: `That is not valid JSON, so it was not run: ${messageOf(error)}`,
      });
      return;
    }
    try {
      setMangoOutcome({
        ok: true,
        query,
        value: runMango(
          database.documents,
          parsed as Parameters<typeof runMango>[1],
        ),
      });
    } catch (error) {
      setMangoOutcome({ ok: false, query, message: messageOf(error) });
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
            <OutcomeTerminal outcome={sqlOutcome} language="sql">
              {(result) => (
                <ResultTable
                  columns={result.columns}
                  rows={result.rows}
                  truncated={result.truncated}
                  elapsedMs={result.elapsedMs}
                />
              )}
            </OutcomeTerminal>
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
            <OutcomeTerminal outcome={mangoOutcome} language="mango">
              {(result) => (
                <JsonResult
                  docs={result.docs}
                  matched={result.matched}
                  truncated={result.truncated}
                  elapsedMs={result.elapsedMs}
                />
              )}
            </OutcomeTerminal>
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
  const share = total === null ? undefined : Math.min(received / total, 1);
  return (
    <Callout
      intent="primary"
      className="playground__loading"
      title="Reading the database"
    >
      <p>
        {formatBytes(received)}
        {total === null ? '' : ` of ${formatBytes(total)}`} — it downloads once,
        then runs in this tab with nothing sent back.
      </p>
      <ProgressBar
        value={share}
        intent="primary"
        stripes={share === undefined}
      />
    </Callout>
  );
}

function OutcomeTerminal<T>({
  outcome,
  language,
  children,
}: {
  outcome: Outcome<T>;
  language: QueryLanguage;
  children: (value: T) => ReactElement;
}): ReactElement | null {
  if (outcome === null) return null;
  return (
    <Terminal
      query={outcome.query}
      language={language}
      error={outcome.ok ? undefined : outcome.message}
    >
      {outcome.ok ? children(outcome.value) : null}
    </Terminal>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
