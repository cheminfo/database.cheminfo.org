/**
 * What this site says about itself: the record the shared About page is drawn
 * from. The prose limits are checked by `aboutProblems` in the test suite, so
 * this file never grows into a page nobody reads.
 */

import { BUILD_INFO } from 'react-cheminfo/build-info';
import type { AboutContent } from 'react-cheminfo/core';
import { PLATFORM_WORK, TEACHING_WORK } from 'react-cheminfo/core';

/** The About record of database.cheminfo.org. */
export const ABOUT: AboutContent = {
  siteId: 'database',
  // Which release, built when, from which commit: the build says so,
  // because a version written by hand is wrong by the next release.
  build: BUILD_INFO,
  what: 'Ask one real chemical dataset the same question in SQL and in Mango, in the browser, and compare the two answers.',
  can: [
    'Run SQL and CouchDB Mango queries over the same data, side by side.',
    'Read the tables, their columns and their foreign keys as one diagram.',
    'Follow a tutorial into both editors, then solve exercises checked against exact rows.',
    'Draw a fragment and watch its 512-bit index screen compounds before atoms are compared.',
    'Translate between the two languages with a printable cheatsheet.',
    'Hand out any query as a link, or frame it in a course page.',
  ],
  paragraphs: [
    'The database is a single SQLite file the browser fetches once and queries in place. Nothing is sent anywhere: the engine is compiled to WebAssembly and runs in the page, so a query over a few hundred thousand rows costs a page load and nothing more.',
    'The same rows are loaded into PouchDB, which answers Mango selectors the way CouchDB does. So a question asked in two languages is asked of the same data, and the difference a student sees is the difference between the languages themselves.',
  ],
  people: [{ name: 'Luc Patiny' }],
  providedBy: ['epfl'],
  credits: [
    'sqlite-wasm',
    'pouchdb',
    'chemexper',
    'react-cheminfo',
    'blueprint',
    'react',
    'vite',
  ],
  cite: [PLATFORM_WORK, TEACHING_WORK],
};
