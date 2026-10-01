/**
 * What each address says in the HTML the server hands out, above the crawl path.
 *
 * All 46 addresses used to ship the same body — this site's menu — so a crawler
 * was handed one text for the browser, every tutorial step and every exercise.
 * Read by the build and by nothing else: `vite.config.ts` calls it once per
 * route, so none of this reaches the bundle a browser downloads.
 *
 * A tutorial step says what the step says, and shows the query it opens with: a
 * step exists to be read. An exercise says what it asks and never its solution.
 */

import type { PageContent, RouteMeta } from 'react-cheminfo/core';
import { plainProse } from 'react-cheminfo/core';

import { EXERCISES } from './data/exercises.ts';
import { TUTORIAL_STEPS } from './data/tutorial.ts';

/** The pages the header lists, each in its own words. */
const PAGES: Record<string, PageContent> = {
  '/': {
    heading: 'Query a chemical database in your browser',
    paragraphs: [
      'Write SQL against a real chemical database and read the rows back, with the structures drawn. The database runs in the page, so a query that would take a server down takes only your own tab.',
      'The same data can be searched by substructure, browsed table by table, or worked through as a tutorial and a set of marked exercises.',
    ],
  },
  '/browse': {
    heading: 'Browse the tables, row by row',
    paragraphs: [
      'Every table of the database with its columns and its rows, structures drawn where a row holds one, so the shape of the data is visible before a query is written against it.',
    ],
  },
  '/substructure': {
    heading: 'Search the database by substructure',
    paragraphs: [
      'Draw a fragment and every compound containing it comes back. The screening and the atom-by-atom match both run in the page, against the same database the SQL editor queries.',
    ],
  },
  '/schema': {
    heading: 'The schema: tables, columns and how they join',
    paragraphs: [
      'What each table holds, which column is its key, and which column joins it to the next — the page to read before writing a query that spans two tables.',
    ],
  },
  '/tutorial': {
    heading: 'From one SELECT to a join, step by step',
    paragraphs: [
      'A guided tour of querying this database, each step preloaded into the live editor: run it, change it, break it and read the error. Each step is given in SQL and, where it can be expressed, as a Mango query too.',
    ],
  },
  '/exercises': {
    heading: 'Write the query, and be marked on it',
    paragraphs: [
      'Each exercise asks for a result set and marks your query by the rows it returns, not by how you wrote it — so any correct query passes, in SQL or in Mango.',
    ],
  },
  '/cheatsheet': {
    heading: 'The query syntax, on one page',
    paragraphs: [
      'The clauses in the order they are written, the join forms, the aggregate functions and the chemical operators this database adds — each with a query that runs.',
    ],
  },
  '/about': {
    heading: 'What this is, and where the data comes from',
    paragraphs: [
      'What you can do here, which database engine runs in the page, where the compounds and their properties come from, and what to cite.',
    ],
  },
};

/**
 * What one address says for itself.
 *
 * Read by `cheminfoPrerender` once per route at build time.
 * @param route - The address being written.
 * @returns Its text — authored for a page the header lists, the step's or the
 * exercise's own prose under `/tutorial` and `/exercises`, and otherwise the
 * name and sentence the route already carries.
 */
export function pageContent(route: RouteMeta): PageContent {
  const authored = PAGES[route.path];
  if (authored !== undefined) return authored;

  const step = stepContent(route.path);
  if (step !== undefined) return step;

  const exercise = exerciseContent(route.path);
  if (exercise !== undefined) return exercise;

  return { heading: route.title, paragraphs: [route.description] };
}

/** One tutorial step, in the words it is written in, with its query. */
function stepContent(path: string): PageContent | undefined {
  const id = idUnder('/tutorial/', path);
  if (id === undefined) return undefined;
  const index = TUTORIAL_STEPS.findIndex((step) => step.id === id);
  const step = TUTORIAL_STEPS[index];
  if (step === undefined) return undefined;

  const paragraphs = [
    `Step ${index + 1} of ${TUTORIAL_STEPS.length} of the SQL tutorial. ${plainProse(step.description)}`,
  ];
  if (step.sql !== undefined && step.sql !== '') {
    paragraphs.push(
      `It opens on the query ${plainProse(step.sql).replaceAll(/\s+/g, ' ')}, which you can run and change in place.`,
    );
  }
  return { heading: step.title, paragraphs };
}

/** One exercise: what it asks, and how it is marked. Never the solution. */
function exerciseContent(path: string): PageContent | undefined {
  const id = idUnder('/exercises/', path);
  if (id === undefined) return undefined;
  const exercise = EXERCISES.find((candidate) => candidate.id === id);
  if (exercise === undefined) return undefined;

  const hints = exercise.hints.length;
  const language =
    exercise.language === 'either'
      ? 'in SQL or as a Mango query'
      : `in ${exercise.language === 'sql' ? 'SQL' : 'Mango'}`;
  return {
    heading: exercise.title,
    paragraphs: [
      plainProse(exercise.description),
      `A ${exercise.level} exercise, answered ${language}. It is marked by the rows your query returns rather than by how you wrote it${hints === 0 ? '.' : `, with ${hints} hint${hints === 1 ? '' : 's'} if you want them.`}`,
    ],
  };
}

/** The single segment under a section, or `undefined` for anything else. */
function idUnder(section: string, path: string): string | undefined {
  if (!path.startsWith(section)) return undefined;
  const rest = path.slice(section.length);
  return rest === '' || rest.includes('/') ? undefined : rest;
}
