/**
 * What the visitor is looking at: which page, which of its items, and the
 * configuration the link they opened carries.
 *
 * Session-only. Nothing here is persisted, and nothing here knows how an
 * address is written — `router.ts` owns that, and reads these signals.
 */

import { signal } from '@preact/signals-react';
import {
  isHidden as isPartHidden,
  parseShareConfig,
} from 'react-cheminfo/core';

import type { TabId } from '../routes.ts';

import type { DatabaseShareConfig } from './shareConfig.ts';
import { SHARE_VOCABULARY } from './shareConfig.ts';

/** Ephemeral, cross-component view state. */
export const view = {
  /** The page on screen. */
  tab: signal<TabId>('playground'),
  /** The item it has open — a tutorial step, an exercise — or nothing. */
  itemId: signal<string | null>(null),
  /**
   * Read once from the address the page opened on, and re-applied to every
   * address the app writes afterwards, so a reload — or a link copied out of
   * the iframe — restores the same configuration.
   */
  share: signal<DatabaseShareConfig>(readShareConfig()),
};

/**
 * Whether the link the page was opened with switches a part off.
 *
 * Hidden means hidden, not disabled: the value a hidden control carries still
 * applies, so an embedder can preset what a visitor may not change.
 * @param key - The part, as `?hide=` names it.
 * @returns True when the part must not be rendered.
 */
export function isHidden(key: string): boolean {
  return isPartHidden(view.share.value, key);
}

function readShareConfig(): DatabaseShareConfig {
  const search = globalThis.location?.search ?? '';
  return parseShareConfig(search, SHARE_VOCABULARY);
}
