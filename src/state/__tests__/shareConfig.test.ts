import {
  applyShareConfig,
  isHidden,
  parseShareConfig,
  suggestedShareConfig,
} from 'react-cheminfo/core';
import { expect, test } from 'vitest';

import { DEFAULT_ROWS, MAX_ROWS, SHARE_VOCABULARY } from '../shareConfig.ts';

test('a plain address configures nothing', () => {
  const config = parseShareConfig('', SHARE_VOCABULARY);

  expect(config).toStrictEqual({
    embed: false,
    hidden: [],
    params: { rows: DEFAULT_ROWS },
  });
  expect(applyShareConfig('', config, SHARE_VOCABULARY)).toBe('');
});

test('a hand-typed ?embed reads the same as ?embed=1', () => {
  expect(parseShareConfig('?embed', SHARE_VOCABULARY).embed).toBe(true);
  expect(parseShareConfig('?embed=1', SHARE_VOCABULARY).embed).toBe(true);
  expect(parseShareConfig('?embed=0', SHARE_VOCABULARY).embed).toBe(false);
});

test('an unknown hide key is ignored rather than throwing', () => {
  const config = parseShareConfig(
    '?hide=mango,editorNobodyRenamedYet,sql',
    SHARE_VOCABULARY,
  );

  // Ordered by the vocabulary, so one selection always writes one link.
  expect(config.hidden).toStrictEqual(['sql', 'mango']);
  expect(isHidden(config, 'mango')).toBe(true);
  expect(isHidden(config, 'schema')).toBe(false);
});

test('a link cannot ask for more rows than the table serves', () => {
  expect(parseShareConfig('?rows=100000', SHARE_VOCABULARY).params.rows).toBe(
    MAX_ROWS,
  );
  expect(parseShareConfig('?rows=0', SHARE_VOCABULARY).params.rows).toBe(1);
  expect(parseShareConfig('?rows=twelve', SHARE_VOCABULARY).params.rows).toBe(
    DEFAULT_ROWS,
  );
});

test('the tool inputs of the address survive a configuration being written', () => {
  const config = parseShareConfig('?embed=1&hide=examples', SHARE_VOCABULARY);
  const search = applyShareConfig(
    '?sql=SELECT%201&hide=examples&embed=1',
    config,
    SHARE_VOCABULARY,
  );

  expect(search).toBe('sql=SELECT%201&embed=1&hide=examples');
});

test('a plus in a query is a plus, not a space', () => {
  const config = parseShareConfig('', SHARE_VOCABULARY);

  expect(applyShareConfig('?sql=1+1', config, SHARE_VOCABULARY)).toBe(
    'sql=1%2B1',
  );
});

test('the dialog opens on the link somebody actually hands out', () => {
  const suggested = suggestedShareConfig(SHARE_VOCABULARY);

  expect(suggested.embed).toBe(true);
  expect(suggested.hidden).toStrictEqual(['examples']);
});
