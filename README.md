# database.cheminfo.org

Ask the same chemistry question twice — once in **SQL**, once in **Mango** — over
one real dataset, in the browser.

A student opens the page, a SQLite database of 541 catalogued substances
downloads once, and both editors run against it locally. Nothing is sent back:
the SQL runs in SQLite compiled to WebAssembly, and the Mango runs against the
same rows, folded in the page into one JSON document per compound. Putting the two shapes
side by side is the point — the tables show why a boiling point needs a pressure
column, and the documents show what a join looks like when there is nothing to
join.

## The data

Everything comes from [ChemExper](https://www.chemexper.com), and nothing is
simulated.

|                                                               |                       |
| ------------------------------------------------------------- | --------------------- |
| Compounds                                                     | 541                   |
| Structures — molfile, SMILES, molecular and monoisotopic mass | 541                   |
| Names, in English, German and French                          | 2,033                 |
| Catalogue listings                                            | 1,049                 |
| Melting points · boiling points · densities · flash points    | 736 · 558 · 434 · 106 |
| Hazard statements (GHS, R- and S-phrases)                     | 7,423                 |
| IR spectra, with their original JCAMP-DX                      | 171                   |
| IR bands — the supplier's own, and peaks picked here          | 4,463                 |
| 1H NMR spectra, with their original JCAMP-DX                  | 50                    |
| NMR ranges → signals → coupling constants                     | 292 → 307 → 197       |

**Prices are removed.** There is no price, currency or quantity column anywhere,
and no document mentions one. The site teaches querying, not purchasing.

### A property belongs to a listing, not to a substance

This is the shape of the database, and the thing it is built to teach. A melting
point is a claim made by one supplier about one catalogue entry, so it hangs off
`catalog_entries` rather than off `compounds`. Ask a compound for its boiling
point and you get a **set**:

```sql
SELECT b.low_c, b.pressure_mmhg, e.supplier
FROM boiling_points b
JOIN catalog_entries e ON e.id = b.catalog_entry_id
JOIN compounds c ON c.id = e.compound_id
WHERE c.preferred_name = '1,2-Diaminocyclohexane'
ORDER BY b.pressure_mmhg DESC;
--  188 °C @ 760 mmHg
--  104 °C @  40 mmHg
--   79 °C @  15 mmHg
```

That is vacuum distillation, and it is why the column is there.

### The spectra

Each spectrum is stored with the **original JCAMP-DX** it was measured into, so
a student can read the file the instrument wrote as well as the peaks picked
from it.

- **IR** carries two peak lists in one table, told apart by `ir_peaks.source`:
  `reported` is the supplier's own band list, `picked` is what
  [`ml-gsd`](https://github.com/mljs/global-spectral-deconvolution) finds at
  build time. Comparing them is an exercise.
- **1H NMR** is picked with
  [`nmr-processing`](https://github.com/cheminfo/nmr-processing) into the chain
  `spectrum → range → signal → coupling`, so a `dd` is two rows in
  `nmr_couplings` under one row in `nmr_signals`.

The stored NMR JCAMP-DX keeps the header, the NTUPLES declaration and the real
page of the Bruker export. The instrument parameter block, the audit trail and
the imaginary page are dropped — 60 % of the bytes, none of the measurement.

### Known rough edges in the source

Accented characters are missing from some German and French names — the source
stores `Dithyle oxyde`, not `Diéthyle oxyde`. Names are recorded verbatim rather
than guessed at.

## Addresses

| Address                          | What it opens                                                              |
| -------------------------------- | -------------------------------------------------------------------------- |
| `/`                              | the playground                                                             |
| `/?sql=…&mango=…`                | the playground, with both editors preloaded — this is the link to hand out |
| `/tutorial` · `/tutorial/<step>` | the guided tour                                                            |
| `/exercises` · `/exercises/<id>` | the challenges                                                             |
| `/schema`                        | the diagram, then the tables, their columns and their keys                 |
| `/cheatsheet`                    | SQL ↔ Mango, printable                                                     |
| `/about`                         | what this is, what it is built on, how to cite it                          |

Configuration any address may carry:

| Parameter | Meaning                                            |
| --------- | -------------------------------------------------- |
| `embed`   | drop the site chrome, for framing in a course page |
| `hide=`   | switch parts off by name: `sql`, `mango`, `schema` |
| `rows=`   | cap the result table (clamped)                     |

```html
<iframe
  src="https://database.cheminfo.org/?embed=1&hide=mango&sql=SELECT%20*%20FROM%20compounds%20LIMIT%2010"
  width="100%"
  height="700"
  style="border: 1px solid #ddd; border-radius: 8px"
  title="database.cheminfo.org — SQL playground"
></iframe>
```

## Browsing the data

`/browse` is the page to open when something looks wrong. It shows one compound
with everything that points at it — every name and the language it is in, every
supplier listing and the claims that listing makes, every hazard statement — and
draws both spectra from the JCAMP-DX the database stores, with the picked peaks
and ranges over them. The IR chart carries the supplier's own band list and the
peaks picked here in one plot, told apart by colour.

The parser (`jcampconverter`) is loaded on demand, so only a visitor who opens a
spectrum downloads it.

## Development

```sh
npm install
npm run dev        # http://localhost:10824 — opens on /browse, the data browser
npm run test       # unit tests, types, tokens, lint, format
npm run test-e2e   # Playwright, against a real browser
npm run build      # prerenders one HTML file per route, plus the sitemap
```

## Rebuilding the database

`public/chem.sqlite` is committed, so the site builds without network access.
Rebuilding it re-reads ChemExper, and the steps are cached on disk so a re-run
costs nothing:

```sh
node scripts/harvest/01-spectra-index.mjs   # which entries carry IR or NMR
node scripts/harvest/02-details.mjs         # the catalogue record of each
node scripts/harvest/03-compounds.mjs       # group by structure, gather listings
node scripts/harvest/04-multi-pressure.mjs  # add substances whose listings disagree
node scripts/harvest/05-jcamp.mjs           # download every spectrum
node scripts/harvest/06-nmr.mjs             # reduce the exports, pick ranges
node scripts/harvest/07-ir.mjs              # pick bands on absorbance
node scripts/harvest/09-backfill.mjs        # fill listings that have no record yet
node scripts/harvest/08-build-db.mjs        # assemble public/chem.sqlite
```

The schema lives in `scripts/harvest/schema.sql`, commented with why each table
is shaped the way it is. The page at `/schema` describes the same tables from
`src/data/schema.ts`, and the diagram at the top of it is drawn from that
record — `src/data/schemaDiagram.ts` places a box per table and an arrow per
foreign key, so a table added there appears in the picture with no SVG to
edit.

Check any query against the shipped database from the terminal, with the same
two engines the browser uses:

```sh
node --experimental-strip-types scripts/run-query.mjs sql "SELECT COUNT(*) FROM compounds"
node --experimental-strip-types scripts/run-query.mjs mango '{"selector":{"charge":{"$gt":0}},"limit":3}'
```

`nmr-processing` runs at build time only, which is why it is not a dependency of
the site. `jcampconverter` is one, because the browser reads the stored JCAMP-DX
to draw a spectrum.

## Environment

| Variable          | Default                                  | What it does                                                                                                                                         |
| ----------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`            | `10824`                                  | the port the container publishes, and the dev server                                                                                                 |
| `TRACKING_SCRIPT` | unset                                    | the analytics snippet, injected at the end of `<head>` when the container starts. Unset means nothing is loaded, so a development run tracks nothing |
| `IMAGE_NAME`      | `ghcr.io/cheminfo/database.cheminfo.org` | the image compose runs                                                                                                                               |
| `IMAGE_TAG`       | `latest`                                 | rewritten by the server's deploy script — never edit by hand                                                                                         |

## Deployment

Three committed compose files, one picked with `COMPOSE_FILE` in `.env`:

```sh
cp .env.example .env
# uncomment exactly one COMPOSE_FILE line
docker compose up -d
```

Every mode publishes the same image and probes `/health`, which
static-web-server answers with a 200 and no access-log line.

> **The image cannot be built until `react-cheminfo` carrying this site's
> ecosystem entry is published.** The entry — the two colours, the mark, the
> tagline — lives in `react-cheminfo/src/ecosystem/core/sites.ts`, and the
> published 0.9.0 does not have it yet, so a build inside the container fails
> with `unknown ecosystem site: database`. Until that release lands,
> `package.json` depends on the local checkout (`file:../../react-cheminfo`),
> which is what makes `npm run dev`, `npm run test` and `npm run build` work
> here. When it is published, change that one line back to a `^` range.

## Licence

MIT. The chemical data is ChemExper's; see `/about` for how to credit it.
