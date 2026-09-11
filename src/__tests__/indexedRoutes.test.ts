import { expect, test } from 'vitest';

import { EXERCISES } from '../data/exercises.ts';
import { TUTORIAL_STEPS } from '../data/tutorialSteps.ts';
import { INDEXED_ROUTES } from '../indexedRoutes.ts';
import { ROUTES } from '../routes.ts';

test('every page, tutorial step and exercise is an indexed address', () => {
  expect(INDEXED_ROUTES).toHaveLength(
    ROUTES.length + TUTORIAL_STEPS.length + EXERCISES.length,
  );
  for (const step of TUTORIAL_STEPS) {
    expect(
      INDEXED_ROUTES.some((route) => route.path === `/tutorial/${step.id}`),
      step.id,
    ).toBe(true);
  }
  for (const exercise of EXERCISES) {
    expect(
      INDEXED_ROUTES.some(
        (route) => route.path === `/exercises/${exercise.id}`,
      ),
      exercise.id,
    ).toBe(true);
  }
});

test('no address is listed twice', () => {
  const paths = INDEXED_ROUTES.map((route) => route.path);
  expect(new Set(paths).size).toBe(paths.length);
});

test('every description is the length a search result shows', () => {
  for (const route of INDEXED_ROUTES) {
    expect(
      route.description.length,
      `${route.path}: ${route.description}`,
    ).toBeGreaterThanOrEqual(110);
    expect(
      route.description.length,
      `${route.path}: ${route.description}`,
    ).toBeLessThanOrEqual(160);
  }
});

test('no two pages are described the same way', () => {
  const descriptions = INDEXED_ROUTES.map((route) => route.description);
  expect(new Set(descriptions).size).toBe(descriptions.length);
});

test('no two pages carry the same title', () => {
  const titles = INDEXED_ROUTES.map((route) => route.title);
  expect(new Set(titles).size).toBe(titles.length);
});

test('a title is short enough to survive the site name being appended', () => {
  for (const route of INDEXED_ROUTES) {
    expect(route.title.length, route.path).toBeLessThanOrEqual(60);
  }
});

test('no description still carries the markup the prose was written with', () => {
  for (const route of INDEXED_ROUTES) {
    expect(route.description, route.path).not.toMatch(/\[\[|`/);
  }
});
