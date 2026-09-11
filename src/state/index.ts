/**
 * The whole application state, in one object read with `useSignals()`.
 *
 * `view` is what the visitor is looking at; the pages add `data` and
 * `preferences` beside it as they need them.
 */

import { view } from './view.ts';

/** The application state: buckets of signal leaves, never a store. */
export const state = { view };

export type { DatabaseShareConfig } from './shareConfig.ts';
export { isHidden } from './view.ts';
export { navigate, router, startRouter } from './router.ts';
