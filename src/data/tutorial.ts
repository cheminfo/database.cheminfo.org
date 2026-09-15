/**
 * The tutorial, as the pages read it: the steps, the three groups they are
 * drawn in, and the glossary their prose leans on.
 *
 * The content itself lives next door — `tutorialSteps.ts` holds the eighteen
 * steps, `glossary.ts` the terms `[[marked]]` inside their descriptions — so
 * this module stays the one import a page needs.
 */

import type { TutorialLevel, TutorialStep } from './tutorialSteps.ts';
import { TUTORIAL_STEPS } from './tutorialSteps.ts';

export type {
  QueryLanguage,
  TutorialLevel,
  TutorialStep,
} from './tutorialSteps.ts';
export { TUTORIAL_LEVEL_LABELS, TUTORIAL_STEPS } from './tutorialSteps.ts';
export type { GlossaryEntry } from 'react-cheminfo/core';
export { GLOSSARY } from './glossary.ts';

/**
 * The step an address names.
 * @param id - The `id` in `/tutorial/<id>`.
 * @returns The step, or undefined when no step carries that id.
 */
export function stepById(id: string): TutorialStep | undefined {
  for (const step of TUTORIAL_STEPS) {
    if (step.id === id) return step;
  }
  return undefined;
}

/**
 * The steps of one group, in the order they are given.
 * @param level - The group being asked for.
 * @returns Its steps.
 */
export function stepsByLevel(level: TutorialLevel): TutorialStep[] {
  return TUTORIAL_STEPS.filter((step) => step.level === level);
}
