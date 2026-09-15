import type { ReactElement, ReactNode } from 'react';
import { useMemo } from 'react';
import type { CodeBlockTone } from 'react-cheminfo/ui';
import { CodeBlock } from 'react-cheminfo/ui';

import type { QueryLanguage } from '../query/queryCode.ts';
import { formatQuery, highlightQuery } from '../query/queryCode.ts';

export interface QueryCodeProps {
  /** The query, as authored. */
  code: string;
  /** The notation it is written in, which decides the colours. */
  language: QueryLanguage;
  /**
   * Whether the query is laid out over several lines before it is shown.
   * Leave it off for a fragment, or for a query already written to be read.
   * @default false
   */
  format?: boolean;
  /**
   * Whether a copy button sits in the corner.
   * @default false
   */
  copyable?: boolean;
  /**
   * How the block is painted.
   * @default 'muted'
   */
  tone?: CodeBlockTone;
  /**
   * Class the block carries.
   * @default undefined
   */
  className?: string;
}

/**
 * A SQL or Mango query, syntax coloured, in a code block.
 * @param props - The query and how it is shown.
 * @returns The code block.
 */
export function QueryCode(props: QueryCodeProps): ReactElement {
  const {
    language,
    format = false,
    copyable = false,
    tone = 'muted',
    className,
  } = props;
  const code = format ? formatQuery(props.code, language) : props.code;

  return (
    <CodeBlock
      code={code}
      tone={tone}
      copyable={copyable}
      className={
        className === undefined ? 'query-code' : `query-code ${className}`
      }
    >
      <HighlightedQuery code={code} language={language} />
    </CodeBlock>
  );
}

export interface HighlightedQueryProps {
  /** The text to colour: a query, or a JSON document. */
  code: string;
  /** The notation it is written in. */
  language: QueryLanguage;
}

/**
 * The coloured runs of a query, with no frame around them, for a place that
 * draws its own — a terminal, for instance.
 * @param props - The text and its notation.
 * @returns The runs, as spans carrying `query-code__<kind>` classes.
 */
export function HighlightedQuery(props: HighlightedQueryProps): ReactElement {
  const { code, language } = props;
  // A result pane re-renders on every keystroke in the editor above it.
  const nodes = useMemo(() => {
    const runs: ReactNode[] = [];
    let offset = 0;
    for (const token of highlightQuery(code, language)) {
      runs.push(
        token.kind === undefined ? (
          token.text
        ) : (
          <span key={offset} className={`query-code__${token.kind}`}>
            {token.text}
          </span>
        ),
      );
      offset += token.text.length;
    }
    return runs;
  }, [code, language]);
  return <>{nodes}</>;
}
