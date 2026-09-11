import { aboutProblems, resolveAbout } from 'react-cheminfo/core';
import { expect, test } from 'vitest';

import { ABOUT } from '../about.ts';

test('the record says what the family checks it says', () => {
  expect(aboutProblems(ABOUT)).toStrictEqual([]);
});

test('what a visitor is told they can do is the six things the site does', () => {
  expect(ABOUT.siteId).toBe('database');
  expect(ABOUT.can).toHaveLength(6);
  expect(ABOUT.paragraphs).toHaveLength(2);
});

test('every borrowed work the site runs on is named, and named once', () => {
  expect(ABOUT.credits).toStrictEqual([
    'sqlite-wasm',
    'pouchdb',
    'chemexper',
    'react-cheminfo',
    'blueprint',
    'react',
    'vite',
  ]);
  expect(new Set(ABOUT.credits).size).toBe(ABOUT.credits.length);
});

test('the record resolves against the shared registries', () => {
  const about = resolveAbout(ABOUT);

  expect(about.site.host).toBe('database.cheminfo.org');
  expect(about.license).toBe('MIT');
  expect(about.repository).toBe(
    'https://github.com/cheminfo/database.cheminfo.org',
  );
  expect(about.issues).toBe(
    'https://github.com/cheminfo/database.cheminfo.org/issues',
  );
  expect(about.credits.map((entry) => entry.name)).toStrictEqual([
    'SQLite Wasm',
    'PouchDB',
    'ChemExper',
    'react-cheminfo',
    'Blueprint',
    'React',
    'Vite',
  ]);
});

test('the teaching and the platform papers are what it asks to be cited', () => {
  const dois = (ABOUT.cite ?? []).map((work) => work.reference.doi);

  expect(dois).toStrictEqual([
    '10.2533/chimia.2023.683',
    '10.2533/chimia.2025.66',
  ]);
});

test('the paragraphs say where the queries run and what answers them', () => {
  const [engine, mango] = ABOUT.paragraphs ?? [];

  expect(engine).toContain('WebAssembly');
  expect(engine).toContain('Nothing is sent anywhere');
  expect(mango).toContain('PouchDB');
  expect(mango).toContain('CouchDB');
});
