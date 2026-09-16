import react from '@vitejs/plugin-react';
import { cheminfoPrerender } from 'react-cheminfo/vite';
import { defineConfig } from 'vite';

import { INDEXED_ROUTES } from './src/indexedRoutes.ts';
import { ROUTES, SITE_ID, SITE_URL } from './src/routes.ts';

/**
 * The one port this project owns, derived from its creation date by
 * rules/backend.md: 2026-08-24 gives 6·08·24 = 60824, which is over 60000, so
 * 50000 comes off. The site has no backend, so the dev server, `vite preview`
 * and the port Docker publishes are all this same number — no sibling claims
 * it, and Vite's stock 5173 would have several of them answering for each
 * other.
 */
const port = Number(process.env.PORT ?? 10_824);

export default defineConfig({
  // The build carries no mount path. Every asset is written relative, so the
  // one `dist` serves this site's own host and a path of a shared one without
  // being rebuilt: the `<base>` the page carries is what resolves them, and the
  // router reads its mount back off that.
  base: './',
  plugins: [
    react(),
    // One real HTML file per routed address, each with its own title,
    // description and canonical. A static image has nothing to rewrite a head
    // per request, so without this every address ships the same head and a
    // search engine folds the whole site into one result. The same table writes
    // `sitemap.xml` and `robots.txt`.
    cheminfoPrerender({
      site: SITE_ID,
      // Every tutorial step and every exercise, not only the pages: each is a
      // link somebody hands out, and the image serves no fallback page.
      routes: INDEXED_ROUTES,
      origin: SITE_URL,
      description:
        'Query a real chemical dataset two ways over the same tables: in SQL, against SQLite compiled to WebAssembly, and in Mango, the CouchDB JSON query language.',
      operatingSystem: 'Any modern browser',
      noscript: {
        // The build bakes in no mount, so the crawl path is written against
        // the `<base>` the page carries rather than the root of a host this
        // deployment may only share.
        hrefs: 'relative',
        heading: 'database.cheminfo.org — one dataset, two query languages',
        intro:
          'Ask the same question of a chemical dataset in SQL and in Mango and compare the two answers. The database is a SQLite file your browser downloads once and queries locally, so nothing you write ever leaves your machine — which is also why the tool needs JavaScript.',
        routes: ROUTES,
        ecosystem: { taglines: false },
      },
    }),
  ],
  resolve: {
    // One copy of each, even when a dependency is linked from a checkout. Two
    // copies of React make components call hooks against a dispatcher the
    // renderer never populated, and the page dies at first render; a molecule
    // built by one copy of openchemlib cannot be searched by another.
    dedupe: ['react', 'react-dom', '@blueprintjs/core', 'openchemlib'],
  },
  // The dataset is read-only and queried in memory, so no OPFS and no
  // SharedArrayBuffer: the COOP/COEP headers the sqlite-wasm README asks for
  // are not needed here, and setting them would make the dev server differ from
  // the static image, which sends none.
  optimizeDeps: {
    // sqlite3.wasm is fetched next to the module that loads it. Prebundling
    // rewrites that `new URL(…, import.meta.url)` into the optimizer's cache,
    // where the file is not.
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    port,
    // Fail loudly instead of drifting to the next free port, which would leave
    // the dev script, the Playwright base URL and the README disagreeing.
    strictPort: true,
    // `npm run dev` opens the data browser, which is where a developer checks
    // what the harvest actually produced. `/` still serves the tool — that is
    // the address people are handed — this only chooses where the window lands.
    // Playwright sets DEV_NO_OPEN, so a test run does not throw a browser
    // window up on every one of its workers.
    open: process.env.DEV_NO_OPEN ? false : '/browse',
  },
  preview: {
    port,
    strictPort: true,
  },
  build: {
    // sqlite-wasm is emscripten output: it assumes a modern engine, and
    // down-levelling it buys nothing a browser running WebAssembly needs.
    target: 'esnext',
    // The SQLite module is 600 kB of compiled C on its own, and it is loaded
    // lazily; the default 500 kB warning only reports that fact once per build.
    chunkSizeWarningLimit: 2048,
  },
});
