/**
 * Every address this site answers, each with the name and the sentence it is
 * indexed under.
 *
 * One table, read by four things that must agree on it: the router, which turns
 * an address into a page; the build, which writes one real HTML file per entry
 * plus the sitemap listing them; the `noscript` crawl path; and the running
 * app, which retitles the tab after an in-app move. A page missing from here is
 * a page a search engine only ever sees as the home page.
 */

import type { RouteMeta } from 'react-cheminfo/core';

/** The site, as the header, the prerender and the share dialog name it. */
export const SITE_ID = 'database';

/** What the site is called in prose, spelled as the address it is. */
export const SITE_NAME = 'database.cheminfo.org';

/** Where the site is served, and what every canonical address is built on. */
export const SITE_URL = 'https://database.cheminfo.org';

/** Where the sources live. */
export const REPOSITORY = 'https://github.com/cheminfo/database.cheminfo.org';

/** The pages, named as the router and the state name them. */
export type TabId =
  | 'playground'
  | 'browse'
  | 'tutorial'
  | 'exercises'
  | 'schema'
  | 'cheatsheet'
  | 'about';

/**
 * A routed page: what a crawler is told about it, plus what the header writes
 * on it and whether it addresses one of its items in a second path segment.
 */
export interface RouteDefinition extends RouteMeta {
  /** The page this address opens. */
  tab: TabId;
  /** How the page is named in the header bar. */
  label: string;
  /**
   * Whether a second path segment names one of the page's items — a tutorial
   * step, an exercise — so a lecturer can hand out a deep link.
   * @default false
   */
  takesId?: boolean;
}

/**
 * The pages, in the order the bar lists them. The first is the home page, and
 * is what an address the site does not know opens.
 *
 * `prefix` is set on the two pages that address their items, so `/tutorial/4`
 * is indexed as the tutorial rather than folded into the home page, and its
 * canonical address is the tutorial's own.
 */
const ROUTE_TABLE = [
  {
    path: '/',
    tab: 'playground',
    label: 'Playground',
    title: 'SQL and Mango playground',
    short: 'Playground',
    note: 'the two editors over the same data',
    description:
      'Ask one chemical dataset the same question twice: write SQL on one side, a CouchDB Mango selector on the other, and compare what each answers.',
  },
  {
    path: '/browse',
    tab: 'browse',
    label: 'Browse',
    title: 'Browse every compound and spectrum',
    short: 'Browse',
    note: 'the rows themselves, and the spectra drawn',
    description:
      'Look through all 541 compounds one at a time: every name and language, every supplier listing and its claims, and the IR and NMR spectra drawn.',
  },
  {
    path: '/tutorial',
    tab: 'tutorial',
    label: 'Tutorial',
    takesId: true,
    prefix: true,
    title: 'Querying chemistry step by step',
    short: 'Tutorial',
    note: 'guided steps, preloaded in both editors',
    description:
      'Learn SELECT, JOIN, GROUP BY and their Mango equivalents one step at a time, each preloaded into both editors over real compounds and spectra.',
  },
  {
    path: '/exercises',
    tab: 'exercises',
    label: 'Exercises',
    takesId: true,
    prefix: true,
    title: 'Query exercises with test cases',
    short: 'Exercises',
    note: 'challenges checked against exact rows',
    description:
      'Write the query that returns exactly the expected rows. Each exercise is checked case by case, with hints running from a nudge to almost the answer.',
  },
  {
    path: '/schema',
    tab: 'schema',
    label: 'Schema',
    title: 'The tables and their keys',
    short: 'Schema',
    note: 'what joins to what, and on which column',
    description:
      'The compound, spectrum, catalogue and property tables of the dataset, with every column, primary key and foreign key drawn as one readable diagram.',
  },
  {
    path: '/cheatsheet',
    tab: 'cheatsheet',
    label: 'Cheatsheet',
    title: 'SQL and Mango, side by side',
    short: 'Cheatsheet',
    note: 'the printable translation table',
    description:
      'A printable reference putting each SQL clause, operator and aggregate next to the CouchDB Mango selector that asks a database the same question.',
  },
  {
    path: '/about',
    tab: 'about',
    label: 'About',
    title: 'About',
    short: 'About',
    note: 'where the data comes from, and how to cite it',
    description:
      'What database.cheminfo.org is, where its compounds, spectra and catalogue entries were harvested from, what it runs on, and how to cite it.',
  },
] as const satisfies readonly RouteDefinition[];

/** The addresses the site answers, as the router writes them. */
export type RoutePath = (typeof ROUTE_TABLE)[number]['path'];

/**
 * Every address the site answers. Widened from the table above so a caller can
 * read `takesId` and `prefix` on any entry rather than only on the two that
 * write them.
 */
export const ROUTES: readonly RouteDefinition[] = ROUTE_TABLE;

/** The page an address the site does not know opens. */
export const HOME_ROUTE: RouteDefinition = ROUTE_TABLE[0];

/**
 * The page a tab is served at.
 * @param tab - The tab being asked about.
 * @returns Its route, which is the home page for a tab the table does not name.
 */
export function routeForTab(tab: TabId): RouteDefinition {
  for (const route of ROUTES) {
    if (route.tab === tab) return route;
  }
  return HOME_ROUTE;
}

/**
 * Whether a page addresses one of its items in a second path segment.
 * @param tab - The tab being asked about.
 * @returns True for the tutorial and the exercises.
 */
export function tabTakesId(tab: TabId): boolean {
  return routeForTab(tab).takesId === true;
}
