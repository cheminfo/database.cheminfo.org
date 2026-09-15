/**
 * Every address a crawler can fetch — the pages, plus one per tutorial step and
 * one per exercise.
 *
 * The router only needs the pages: a step is a place inside the tutorial, not a
 * tab of its own. A crawler needs every one of them, because each is a real
 * address a lecturer hands out, and the static image serves no fallback page —
 * an address with no file behind it is a 404, not the tool under another name.
 */

import type { RouteMeta } from 'react-cheminfo/core';

import { EXERCISES } from './data/exercises.ts';
import { TUTORIAL_STEPS } from './data/tutorialSteps.ts';
import { ROUTES } from './routes.ts';

/** A description is written for a search result, and these are its limits. */
const MIN_DESCRIPTION = 110;
const MAX_DESCRIPTION = 160;

/**
 * Strip the markup content prose carries — `[[term]]` markers and code spans —
 * so a sentence written for the page reads as a sentence in a search result.
 * @param text - The prose as written.
 * @returns The same words, unmarked.
 */
function plain(text: string): string {
  return text
    .replaceAll(/\[\[(?<term>[^\]]+)\]\]/g, '$<term>')
    .replaceAll(/`(?<code>[^`]+)`/g, '$<code>')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

/**
 * Cut prose to a whole sentence that fits a search result.
 *
 * Sentences are taken until the text is long enough, then the result is trimmed
 * at a word boundary if it overran — a description cut mid-word reads as broken
 * in the one place it is meant to sell the page.
 * @param text - The prose to draw from.
 * @returns A description between the two limits.
 */
function describe(text: string): string {
  const source = plain(text);
  const sentences = source.match(/[^.!?]+[.!?]+/g) ?? [source];
  let out = '';
  for (const sentence of sentences) {
    if (out.length >= MIN_DESCRIPTION) break;
    out = `${out}${out ? ' ' : ''}${sentence.trim()}`;
  }
  if (out.length <= MAX_DESCRIPTION) return out;
  const cut = out.slice(0, MAX_DESCRIPTION - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${cut.slice(0, boundary > MIN_DESCRIPTION ? boundary : cut.length).trimEnd()}…`;
}

const tutorialRoutes: RouteMeta[] = TUTORIAL_STEPS.map((step, index) => ({
  path: `/tutorial/${step.id}`,
  title: `${index + 1}. ${step.title}`,
  short: step.title,
  description: describe(step.description),
}));

const exerciseRoutes: RouteMeta[] = EXERCISES.map((exercise) => ({
  path: `/exercises/${exercise.id}`,
  title: exercise.title,
  short: exercise.title,
  description: describe(exercise.description),
}));

/**
 * The route table the build writes files and the sitemap from.
 *
 * The pages keep their `prefix`, so an address below one of them that is
 * not listed here — a step renamed after a link was handed out — is still
 * described as its section rather than as the home page.
 */
export const INDEXED_ROUTES: readonly RouteMeta[] = [
  ...ROUTES,
  ...tutorialRoutes,
  ...exerciseRoutes,
];
