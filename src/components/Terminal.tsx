import type { ReactElement, ReactNode } from 'react';

import type { QueryLanguage } from '../query/queryCode.ts';

import { HighlightedQuery } from './QueryCode.tsx';

export interface TerminalProps {
  /** The query that was run, echoed after the prompt. */
  query: string;
  /** The notation of the query, which decides the prompt and the colours. */
  language: QueryLanguage;
  /**
   * Why the query failed, printed in place of the output.
   * @default undefined
   */
  error?: string;
  /**
   * What the query printed.
   * @default undefined
   */
  children?: ReactNode;
}

/** What each engine's command line reads, as its client would show it. */
const PROMPTS: Record<QueryLanguage, string> = {
  sql: 'sqlite>',
  mango: 'POST /chem/_find',
};

/**
 * A query and what it printed, drawn the way a command line shows them: the
 * prompt, the query echoed in colour, then the output or the error.
 * @param props - The query, and its output or error.
 * @returns The terminal.
 */
export function Terminal(props: TerminalProps): ReactElement {
  const { query, language, error, children } = props;
  return (
    <div
      className="terminal"
      role="log"
      aria-label={`${language === 'sql' ? 'SQL' : 'Mango'} output`}
    >
      <pre className="terminal__command">
        <span className="terminal__prompt">{PROMPTS[language]}</span>
        {language === 'sql' ? ' ' : '\n'}
        <HighlightedQuery code={query.trim()} language={language} />
      </pre>
      {error === undefined ? (
        children
      ) : (
        <p className="terminal__error result__error text-selectable">
          Error: {error}
        </p>
      )}
    </div>
  );
}
