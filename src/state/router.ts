/**
 * Routing by path, through the History API.
 *
 * ```
 * /                 /tutorial/4     /exercises/joins-1
 * /schema           /cheatsheet     /about
 * ```
 *
 * A `#` never reaches the server and is dropped by half the tools that pass
 * links around, so every address here is a real path the build has written a
 * file for. The string ↔ route mapping itself is `createTabRouter`; this module
 * only says where the address is read and what happens when it changes.
 */

import { effect } from '@preact/signals-react';
import {
  applyShareConfig,
  createTabRouter,
  startDocumentMeta,
} from 'react-cheminfo/core';

import type { TabId } from '../routes.ts';
import { ROUTES, SITE_ID, SITE_URL } from '../routes.ts';

import { SHARE_VOCABULARY } from './shareConfig.ts';
import { pathWithoutBase, withBase } from './site.ts';
import { view } from './view.ts';

/** The one place that knows how this site's addresses are written. */
export const router = createTabRouter<TabId>({
  tabs: ROUTES.map((route) => ({
    id: route.tab,
    path: route.path,
    takesId: route.takesId === true,
  })),
  home: 'playground',
  mode: 'path',
});

/**
 * The address of the page on screen, without the query string: what the
 * canonical link and the title are looked up under.
 * @returns The path, e.g. `/tutorial/4`.
 */
export function currentPath(): string {
  return router.format({ tab: view.tab.value, id: view.itemId.value });
}

/**
 * Move to a page, carrying the share configuration and the tool inputs the
 * address already holds, so an embed stays configured across clicks.
 * @param tab - The page to open.
 * @param id - The item it opens on — a tutorial step, an exercise.
 * @default null — the page opens on whatever it opens on by default
 */
export function navigate(tab: TabId, id: string | null = null): void {
  const path = router.format({ tab, id });
  const query = applyShareConfig(
    globalThis.location.search,
    view.share.value,
    SHARE_VOCABULARY,
  );
  const mounted = withBase(path);
  globalThis.history.pushState(
    null,
    '',
    query === '' ? mounted : `${mounted}?${query}`,
  );
  view.tab.value = tab;
  view.itemId.value = id;
}

/**
 * Point the view at the address the browser is showing.
 *
 * An address the site does not know opens the playground, as the build's own
 * fallback does, rather than showing nothing.
 */
export function applyCurrentAddress(): void {
  const { pathname, search } = globalThis.location;
  const route = router.parse(`${pathWithoutBase(pathname)}${search}`);
  view.tab.value = route.tab;
  view.itemId.value = route.id;
}

/**
 * Follow the browser's own navigation, and keep the tab title and the canonical
 * link in step with the page on screen.
 * @returns The function that stops both.
 */
export function startRouter(): () => void {
  applyCurrentAddress();

  globalThis.addEventListener('popstate', applyCurrentAddress);
  const stopTitling = startDocumentMeta({
    site: SITE_ID,
    routes: ROUTES,
    origin: SITE_URL,
    url: currentPath,
    follow: effect,
  });

  return () => {
    stopTitling();
    globalThis.removeEventListener('popstate', applyCurrentAddress);
  };
}
