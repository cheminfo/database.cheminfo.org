/**
 * How far a student has got, kept in this browser.
 *
 * Best effort, and never a precondition: an embedded page whose storage is
 * partitioned still works, it just forgets. What is stored is the attempt
 * itself and how much help was taken — an honest signal for the student to
 * revisit later, not a score.
 */

import { signal } from '@preact/signals-react';
import { persistBucket } from 'react-cheminfo/ui';

/** Where an attempt stands. */
export type ExerciseStatus = 'idle' | 'attempted' | 'solved';

export interface ExerciseAttempt {
  /** What the student last typed. */
  query: string;
  /** Where the attempt stands. */
  status: ExerciseStatus;
  /** How many hints have been shown. */
  hintsRevealed: number;
  /** Whether the solution is on screen. */
  showSolution: boolean;
}

/** What an exercise looks like before anything has been typed into it. */
export function emptyAttempt(): ExerciseAttempt {
  return { query: '', status: 'idle', hintsRevealed: 0, showSolution: false };
}

const store = persistBucket<{ attempts: Record<string, ExerciseAttempt> }>({
  key: 'database:exercises',
  defaults: { attempts: {} },
});

/** Every attempt this browser remembers, keyed by exercise id. */
export const attempts = signal<Record<string, ExerciseAttempt>>(
  store.read().value.attempts,
);

/**
 * Read one exercise's attempt, filling in anything a previous version did not
 * store rather than dropping the whole record.
 * @param id - The exercise.
 * @returns Its attempt.
 */
export function attemptFor(id: string): ExerciseAttempt {
  return { ...emptyAttempt(), ...attempts.value[id] };
}

/**
 * Change one exercise's attempt and keep it.
 * @param id - The exercise.
 * @param change - The fields to change.
 */
export function updateAttempt(
  id: string,
  change: Partial<ExerciseAttempt>,
): void {
  const next = { ...attempts.value, [id]: { ...attemptFor(id), ...change } };
  attempts.value = next;
  store.write({ attempts: next });
}

/** Forget every attempt. */
export function clearAttempts(): void {
  attempts.value = {};
  store.write({ attempts: {} });
}
