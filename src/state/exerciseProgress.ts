/**
 * How far a student has got, kept in this browser.
 *
 * Best effort, and never a precondition: an embedded page whose storage is
 * partitioned still works, it just forgets. What is stored is the attempt
 * itself and how much help was taken — an honest signal for the student to
 * revisit later, not a score.
 */

import { signal } from '@preact/signals-react';
import type { ExerciseProgress, ProgressRecords } from 'react-cheminfo/core';
import { localStorageProgressStore } from 'react-cheminfo/core';

/** What an exercise looks like before anything has been typed into it. */
export function emptyAttempt(): ExerciseProgress {
  return { status: 'idle', answer: '', hintsRevealed: 0, showSolution: false };
}

// Version 2: the record the shared store keeps names the student's text
// `answer`, where this site used to call it `query`.
const store = localStorageProgressStore<ExerciseProgress>({
  key: 'database:exercises',
  version: 2,
  defaults: emptyAttempt(),
});

/** Every attempt this browser remembers, keyed by exercise id. */
export const attempts = signal<ProgressRecords>(readStore());

/**
 * Read one exercise's attempt, filling in anything a previous version did not
 * store rather than dropping the whole record.
 * @param id - The exercise.
 * @returns Its attempt.
 */
export function attemptFor(id: string): ExerciseProgress {
  return attempts.value[id] ?? emptyAttempt();
}

/**
 * Change one exercise's attempt and keep it.
 * @param id - The exercise.
 * @param change - The fields to change.
 */
export function updateAttempt(
  id: string,
  change: Partial<ExerciseProgress>,
): void {
  const next = { ...attempts.value, [id]: { ...attemptFor(id), ...change } };
  attempts.value = next;
  void store.save(next);
}

/** Forget every attempt. */
export function clearAttempts(): void {
  attempts.value = {};
  void store.save({});
}

function readStore(): ProgressRecords {
  // The browser binding answers synchronously. A binding that answered over
  // the network would have to fill this signal after the page had opened.
  const loaded = store.load();
  return loaded instanceof Promise ? {} : loaded;
}
