import type { LanguageFn } from 'highlight.js';
import json from 'highlight.js/lib/languages/json';
import sql from 'highlight.js/lib/languages/sql';
import stringify from 'json-stringify-pretty-compact';
import { createLowlight } from 'lowlight';
import { format } from 'sql-formatter';

/** The two notations a query on this site is written in. */
export type QueryLanguage = 'sql' | 'mango';

/** What a piece of a query is, for colouring. */
export type QueryTokenKind =
  'keyword' | 'string' | 'number' | 'key' | 'operator' | 'comment';

/** A run of query text, and what it is. */
export interface QueryToken {
  /** The text, verbatim. */
  text: string;
  /**
   * What the text is.
   * @default undefined — plain text: names, punctuation, whitespace
   */
  kind?: QueryTokenKind;
}

/**
 * Lays a one-line query out over several lines, one clause or one key per
 * line, so it can be read at a glance.
 *
 * Text that does not parse — a fragment, or prose standing in for a query — is
 * returned as it was.
 * @param code - The query.
 * @param language - The notation it is written in.
 * @returns The query over several lines.
 */
export function formatQuery(code: string, language: QueryLanguage): string {
  try {
    if (language === 'mango') {
      return stringify(JSON.parse(code), { maxLength: 52 });
    }
    return format(code, {
      language: 'sqlite',
      keywordCase: 'upper',
      indentStyle: 'tabularLeft',
    });
  } catch {
    return code;
  }
}

/**
 * Splits a query into coloured runs. Joined back, the runs are the query.
 *
 * In Mango, a key naming an operator (`"$gt"`) is told apart from a key naming
 * a field, because that is the distinction a student is learning to see.
 * @param code - The query.
 * @param language - The notation it is written in.
 * @returns The runs, in order.
 */
export function highlightQuery(
  code: string,
  language: QueryLanguage,
): QueryToken[] {
  const tokens: QueryToken[] = [];
  collect(
    lowlight.highlight(language === 'sql' ? 'sql' : 'json', code),
    undefined,
    tokens,
  );
  return tokens;
}

// highlight.js knows standard SQL; these are the SQLite words our queries use.
const sqlite: LanguageFn = (hljs) => {
  const language = sql(hljs);
  return {
    ...language,
    contains: [
      { scope: 'keyword', match: /\b(?:glob|limit|offset)\b/ },
      { scope: 'built_in', match: /\b(?:group_concat|round)(?=\s*\()/ },
      ...(language.contains ?? []),
    ],
  };
};

const lowlight = createLowlight({ json, sql: sqlite });

type HighlightRoot = ReturnType<typeof lowlight.highlight>;
type HighlightElement = Extract<
  HighlightRoot['children'][number],
  { type: 'element' }
>;

const KIND_BY_CLASS: Record<string, QueryTokenKind> = {
  'hljs-keyword': 'keyword',
  'hljs-built_in': 'keyword',
  'hljs-type': 'keyword',
  'hljs-string': 'string',
  'hljs-number': 'number',
  'hljs-literal': 'number',
  'hljs-attr': 'key',
  'hljs-operator': 'operator',
  'hljs-comment': 'comment',
};

function collect(
  parent: HighlightRoot | HighlightElement,
  kind: QueryTokenKind | undefined,
  tokens: QueryToken[],
): void {
  for (const child of parent.children) {
    if (child.type === 'text') {
      tokens.push(
        kind === undefined
          ? { text: child.value }
          : { text: child.value, kind: refine(kind, child.value) },
      );
    } else if (child.type === 'element') {
      collect(child, kindOf(child) ?? kind, tokens);
    }
  }
}

function kindOf(element: HighlightElement): QueryTokenKind | undefined {
  const classes = element.properties.className;
  if (!Array.isArray(classes)) return undefined;
  for (const name of classes) {
    const kind = KIND_BY_CLASS[name];
    if (kind !== undefined) return kind;
  }
  return undefined;
}

function refine(kind: QueryTokenKind, text: string): QueryTokenKind {
  return kind === 'key' && text.startsWith('"$') ? 'operator' : kind;
}
