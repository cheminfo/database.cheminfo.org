import { expect, test } from 'vitest';

import { CHEAT_SECTIONS } from '../../data/cheatsheet.ts';
import { formatQuery, highlightQuery } from '../queryCode.ts';

test('formatQuery puts each SQL clause on its own line', () => {
  expect(
    formatQuery(
      "SELECT preferred_name, formula FROM compounds WHERE formula IN ('C2H6O', 'C7H8') ORDER BY formula",
      'sql',
    ),
  ).toBe(
    [
      'SELECT    preferred_name,',
      '          formula',
      'FROM      compounds',
      "WHERE     formula IN ('C2H6O', 'C7H8')",
      'ORDER BY  formula',
    ].join('\n'),
  );
});

test('formatQuery gives each Mango key a line and keeps short values inline', () => {
  expect(
    formatQuery(
      '{"selector": {"mass": {"$gt": 300}}, "fields": ["name", "mass"], "sort": [{"mass": "desc"}]}',
      'mango',
    ),
  ).toBe(
    [
      '{',
      '  "selector": {"mass": {"$gt": 300}},',
      '  "fields": ["name", "mass"],',
      '  "sort": [{"mass": "desc"}]',
      '}',
    ].join('\n'),
  );
});

test('formatQuery returns text that does not parse unchanged', () => {
  expect(formatQuery('compounds → names', 'sql')).toBe('compounds → names');
  expect(formatQuery('{"mass": ', 'mango')).toBe('{"mass": ');
});

test('formatQuery keeps every cheatsheet example meaning the same', () => {
  let examples = 0;
  for (const section of CHEAT_SECTIONS) {
    for (const row of section.rows) {
      if (row.example?.mango === undefined) continue;
      examples++;
      expect(JSON.parse(formatQuery(row.example.mango, 'mango'))).toStrictEqual(
        JSON.parse(row.example.mango),
      );
    }
  }
  expect(examples).toBeGreaterThan(40);
});

test('highlightQuery colours SQL keywords, operators, strings and numbers', () => {
  expect(
    highlightQuery(
      "SELECT COUNT(*) AS n FROM compounds WHERE formula = 'C2H6O' AND mass > 30",
      'sql',
    ),
  ).toStrictEqual([
    { text: 'SELECT', kind: 'keyword' },
    { text: ' ' },
    { text: 'COUNT', kind: 'keyword' },
    { text: '(' },
    { text: '*', kind: 'operator' },
    { text: ') ' },
    { text: 'AS', kind: 'keyword' },
    { text: ' n ' },
    { text: 'FROM', kind: 'keyword' },
    { text: ' compounds ' },
    { text: 'WHERE', kind: 'keyword' },
    { text: ' formula ' },
    { text: '=', kind: 'operator' },
    { text: ' ' },
    { text: "'C2H6O'", kind: 'string' },
    { text: ' ' },
    { text: 'AND', kind: 'keyword' },
    { text: ' mass ' },
    { text: '>', kind: 'operator' },
    { text: ' ' },
    { text: '30', kind: 'number' },
  ]);
});

test('highlightQuery knows the SQLite words standard SQL lacks', () => {
  const keywords = highlightQuery(
    "SELECT ROUND(mass, 1), GROUP_CONCAT(formula) FROM compounds WHERE formula GLOB 'C*' LIMIT 10 OFFSET 5",
    'sql',
  )
    .filter((token) => token.kind === 'keyword')
    .map((token) => token.text);
  expect(keywords).toStrictEqual([
    'SELECT',
    'ROUND',
    'GROUP_CONCAT',
    'FROM',
    'WHERE',
    'GLOB',
    'LIMIT',
    'OFFSET',
  ]);
});

test('highlightQuery tells a Mango operator apart from a field', () => {
  expect(highlightQuery('{"mass": {"$gt": 300}}', 'mango')).toStrictEqual([
    { text: '{' },
    { text: '"mass"', kind: 'key' },
    { text: ':' },
    { text: ' ' },
    { text: '{' },
    { text: '"$gt"', kind: 'operator' },
    { text: ':' },
    { text: ' ' },
    { text: '300', kind: 'number' },
    { text: '}' },
    { text: '}' },
  ]);
});
