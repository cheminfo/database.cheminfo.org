import { assertRoutes, pageMetaFor } from 'react-cheminfo/core';
import { expect, test } from 'vitest';

import { HOME_ROUTE, ROUTES, routeForTab, tabTakesId } from '../routes.ts';

test('the site answers the eight addresses, in the order the bar lists them', () => {
  expect(ROUTES.map((route) => route.path)).toStrictEqual([
    '/',
    '/browse',
    '/substructure',
    '/tutorial',
    '/exercises',
    '/schema',
    '/cheatsheet',
    '/about',
  ]);
  expect(HOME_ROUTE.tab).toBe('playground');
});

test('the table is one the build can write files from', () => {
  expect(() => {
    assertRoutes(ROUTES);
  }).not.toThrow();
});

test('every page carries a title and a description written for search', () => {
  const titles = ROUTES.map((route) => route.title);
  const descriptions = ROUTES.map((route) => route.description);

  expect(new Set(titles).size).toBe(ROUTES.length);
  expect(new Set(descriptions).size).toBe(ROUTES.length);

  for (const route of ROUTES) {
    expect(route.title.length).toBeLessThanOrEqual(60);
    expect(route.description.length).toBeGreaterThanOrEqual(110);
    expect(route.description.length).toBeLessThanOrEqual(160);
  }
});

test('only the tutorial and the exercises address one of their items', () => {
  expect(
    ROUTES.filter((route) => route.takesId === true).map((r) => r.tab),
  ).toStrictEqual(['tutorial', 'exercises']);
  expect(tabTakesId('tutorial')).toBe(true);
  expect(tabTakesId('schema')).toBe(false);
});

test('an addressed item is indexed under its section, not under the home page', () => {
  expect(pageMetaFor(ROUTES, '/tutorial/4').path).toBe('/tutorial');
  expect(pageMetaFor(ROUTES, '/exercises/joins-1?rows=10').path).toBe(
    '/exercises',
  );
  expect(pageMetaFor(ROUTES, '/nothing-here').path).toBe('/');
});

test('a tab the table does not name falls back to the home page', () => {
  expect(routeForTab('cheatsheet').path).toBe('/cheatsheet');
});
