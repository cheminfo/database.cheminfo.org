/**
 * The guided tour: eighteen steps, each preloaded into both editors.
 *
 * A step is content, not code. `sql` and `mango` are the two ways of asking the
 * same question of the same 541 compounds, and both are run against the shipped
 * database by `scripts/run-query.mjs` before they ship. Where Mango cannot ask
 * the question at all, `mangoNote` says why in one sentence — that gap is the
 * lesson, not an omission.
 */

import type {
  ExerciseLevel,
  TutorialStep as PedagogicStep,
} from 'react-cheminfo/core';

/** The two languages a step is written in. */
export type QueryLanguage = 'sql' | 'mango';

/** How far into the tour a step sits, and which colour it is drawn in. */
export type TutorialLevel = ExerciseLevel;

/** What a step preloads into the two editors. */
export interface TutorialQueries {
  /** The statement preloaded into the SQL editor. */
  sql: string;
  /**
   * The same question in Mango, as pretty-printed JSON.
   * @default undefined
   */
  mango?: string;
  /**
   * Why Mango cannot ask it, in one sentence. Set when `mango` is absent.
   * @default undefined
   */
  mangoNote?: string;
}

/** One stop of the tour: the shared spine, plus the two queries it preloads. */
export type TutorialStep = PedagogicStep<TutorialQueries>;

/** What the three coloured strips are called. */
export const TUTORIAL_LEVEL_LABELS: Record<TutorialLevel, string> = {
  beginner: 'Reading one table',
  intermediate: 'Following the keys',
  advanced: 'Spectra, and the edges',
};

/** The tour, in the order it is given. */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'select-columns',
    title: 'Ask for columns',
    level: 'beginner',
    description:
      'Name the columns you want, then the table they live in. `compounds` holds one row per substance, keyed by its [[primary key]] `id`. LIMIT stops the engine after ten rows, however many the table holds. Mango asks the same thing with two keys: an empty [[selector]] matches every [[document]], and `fields` is the [[projection]].',
    sql: `SELECT id, preferred_name, formula, nb_suppliers
FROM compounds
LIMIT 10`,
    mango: `{
  "selector": {},
  "fields": ["_id", "name", "formula", "nbSuppliers"],
  "limit": 10
}`,
  },
  {
    id: 'where-and-comparison',
    title: 'Filter rows',
    level: 'beginner',
    description:
      'WHERE drops the rows that fail a test, and two tests joined by AND must both hold. Mango writes the same conjunction as two keys of one object — there is no `$and` to type. An operator is a nested object: `{"$gte": 8}` where SQL writes `>= 8`. Both come back with 26 compounds, each with at least eight degrees of unsaturation — two benzene rings’ worth.',
    sql: `SELECT preferred_name, formula, unsaturation, nb_suppliers
FROM compounds
WHERE unsaturation >= 8 AND nb_suppliers >= 20
ORDER BY nb_suppliers DESC`,
    mango: `{
  "selector": {
    "unsaturation": { "$gte": 8 },
    "nbSuppliers": { "$gte": 20 }
  },
  "fields": ["name", "formula", "unsaturation", "nbSuppliers"]
}`,
  },
  {
    id: 'order-and-limit',
    title: 'Sort, then cut',
    level: 'beginner',
    description:
      'ORDER BY sorts the whole result, and LIMIT takes the front of it — in that order, so the ten most widely supplied come back, not ten arbitrary rows sorted. Mango spells the same pair `sort` and `limit`. Its `sort` takes a direction per field, and every field must run the same way. Note the selector `{"nbSuppliers": {"$gt": 0}}`: a real CouchDB refuses to sort on a field the selector does not mention, because the sort needs an [[index]].',
    sql: `SELECT preferred_name, formula, nb_suppliers
FROM compounds
ORDER BY nb_suppliers DESC
LIMIT 10`,
    mango: `{
  "selector": { "nbSuppliers": { "$gt": 0 } },
  "fields": ["name", "formula", "nbSuppliers"],
  "sort": [{ "nbSuppliers": "desc" }],
  "limit": 10
}`,
  },
  {
    id: 'like-and-regex',
    title: 'Match part of a name',
    level: 'beginner',
    description:
      'LIKE compares with two wildcards: `%` for any run of characters, `_` for exactly one. In SQLite it ignores case for ASCII, so `%ethyl%` also finds Ethyl acetate. Mango has no LIKE; it has `$regex`, which is case-sensitive, so the same 112 compounds need `[Ee]thyl` spelled out. Neither can search inside the `names` table from here — that needs the next group.',
    sql: `SELECT preferred_name, formula, nb_suppliers
FROM compounds
WHERE preferred_name LIKE '%ethyl%'
ORDER BY preferred_name
LIMIT 20`,
    mango: `{
  "selector": { "name": { "$regex": "[Ee]thyl" } },
  "fields": ["name", "formula"],
  "limit": 20
}`,
  },
  {
    id: 'count-and-group-by',
    title: 'Count per group',
    level: 'beginner',
    description:
      '[[GROUP BY]] folds every row sharing a value into one, and an [[aggregate]] such as COUNT then reads each fold. The 2033 names fall into three languages: 1395 English, 629 German and 9 French. Change `COUNT(*)` to `COUNT(DISTINCT compound_id)` and you count compounds instead of names — all 541 have an English name, 346 a German one, 7 a French one. This is the first question Mango cannot answer.',
    sql: `SELECT language, COUNT(*) AS nb_names
FROM names
GROUP BY language
ORDER BY nb_names DESC`,
    mangoNote:
      'A Mango query returns documents, never a row per group, so counting belongs to a CouchDB map-reduce view rather than to a selector.',
  },
  {
    id: 'mango-query-shape',
    title: 'The four keys of a Mango query',
    level: 'beginner',
    description:
      'A Mango query is one JSON object with four keys that do the work: `selector` filters, `fields` projects, `sort` orders and `limit` cuts. `skip` steps over the front, the way OFFSET does. Read them against the SQL clause by clause — the vocabulary is different, the question is not. Both return listings 6 to 10 of the 24 compounds carried by at least a hundred suppliers.',
    sql: `SELECT preferred_name, formula, nb_suppliers
FROM compounds
WHERE nb_suppliers >= 100
ORDER BY nb_suppliers DESC
LIMIT 5 OFFSET 5`,
    mango: `{
  "selector": { "nbSuppliers": { "$gte": 100 } },
  "fields": ["name", "formula", "nbSuppliers"],
  "sort": [{ "nbSuppliers": "desc" }],
  "skip": 5,
  "limit": 5
}`,
  },
  {
    id: 'property-belongs-to-a-listing',
    title: 'A boiling point belongs to a listing',
    level: 'intermediate',
    description:
      'There is no boiling point column on `compounds`, and that is deliberate: a boiling point is one supplier\'s claim, measured at one pressure, so it hangs off `catalog_entries` through a [[foreign key]]. Ask 1,2-Diaminocyclohexane for its boiling point and three answers come back — 188 °C at 760 mmHg, 104 °C at 40 mmHg, 79 °C at 15 mmHg. That is vacuum distillation, and [[normalisation]] is what keeps all three. Mango needs no [[join]] here, because the document already nests the listings under the compound.',
    sql: `SELECT c.preferred_name, e.entry_id, e.supplier,
       b.low_c, b.high_c, b.pressure_mmhg
FROM compounds c
JOIN catalog_entries e ON e.compound_id = c.id
JOIN boiling_points b  ON b.catalog_entry_id = e.id
WHERE c.preferred_name = '1,2-Diaminocyclohexane'
ORDER BY b.pressure_mmhg DESC`,
    mango: `{
  "selector": { "name": "1,2-Diaminocyclohexane" },
  "fields": ["name", "listings"]
}`,
  },
  {
    id: 'join-names-by-language',
    title: 'Join the names, and filter one language',
    level: 'intermediate',
    description:
      'A compound has as many names as anyone gave it, so they live in their own table and a [[join]] brings them back. 2-Propanol carries twelve, across English, German and French. Filter `n.language` and each compound returns only the names in that language. The accents survived unevenly: acetic acid is listed in German both as "Essigsäure" and as "Essigsure", and this database repairs neither.',
    sql: `SELECT c.preferred_name, n.value, n.language
FROM names n
JOIN compounds c ON c.id = n.compound_id
WHERE n.language = 'de'
ORDER BY c.preferred_name
LIMIT 20`,
    mangoNote:
      'The obvious `{"names.language": "de"}` matches nothing, because a dotted path does not step into an array — naming one member\'s field needs [[$elemMatch]], which step 13 introduces.',
  },
  {
    id: 'left-join-and-null',
    title: 'LEFT JOIN, and what NULL means',
    level: 'intermediate',
    description:
      'A [[join]] keeps only the rows that have a partner, so it silently answers a different question than the one you asked. [[LEFT JOIN]] keeps every compound and fills the spectrum columns with [[NULL]] when there is none. Testing `s.id IS NULL` then returns exactly the 370 compounds with no IR spectrum of the 541. Mango asks it as `{"ir": {"$size": 0}}`, because an absent branch is an empty array in the document, not a missing one.',
    sql: `SELECT c.preferred_name, c.formula, s.source_id, s.solvent
FROM compounds c
LEFT JOIN ir_spectra s ON s.compound_id = c.id
WHERE s.id IS NULL
ORDER BY c.preferred_name
LIMIT 15`,
    mango: `{
  "selector": { "ir": { "$size": 0 } },
  "fields": ["name", "formula"],
  "limit": 15
}`,
  },
  {
    id: 'group-by-having',
    title: 'HAVING filters groups',
    level: 'intermediate',
    description:
      'WHERE runs before the rows are folded and [[HAVING]] runs after, which is why a condition on COUNT can only go in HAVING. Here WHERE drops the five other hazard systems, [[GROUP BY]] folds the GHS codes, and HAVING keeps the five that at least twenty listings carry. H319 leads at 116 listings, then H315 at 115 and H335 at 104 — eye, skin, airway, the three most cited irritations in this catalogue. Move the `>= 20` into WHERE and the engine refuses: misuse of aggregate function COUNT().',
    sql: `SELECT code, description, COUNT(*) AS nb_listings
FROM hazard_statements
WHERE system = 'ghs-hazard'
GROUP BY code
HAVING nb_listings >= 20
ORDER BY nb_listings DESC`,
    mangoNote:
      'Mango has neither a fold nor a count, so a threshold on the size of a group cannot be written as a selector at all.',
  },
  {
    id: 'three-table-join',
    title: 'Three tables to a melting point',
    level: 'intermediate',
    description:
      'Melting points hang off listings, and listings hang off compounds, so the name and the temperature are two [[foreign key]] hops apart. Read the FROM clause as a path: start at `melting_points`, step up to the entry that claims it, step up again to the compound. Reverse the order of the joins and the result is identical — the engine\'s [[query planner]] decides how to walk it, not you. The shortest path in the schema is a single hop: `structures` holds each compound’s molecular weight, one row apiece, behind `structures.compound_id`.',
    sql: `SELECT c.preferred_name, c.formula, e.supplier, m.low_c, m.high_c
FROM melting_points m
JOIN catalog_entries e ON e.id = m.catalog_entry_id
JOIN compounds c       ON c.id = e.compound_id
WHERE m.low_c >= 200
ORDER BY m.low_c DESC
LIMIT 20`,
    mangoNote:
      'Mango can test a grandchild, but it returns the whole compound rather than the melting point that matched, so the one row per claim SQL gives here has no Mango equivalent.',
  },
  {
    id: 'aggregate-functions',
    title: 'COUNT, MIN, MAX, AVG',
    level: 'intermediate',
    description:
      'An [[aggregate]] reads many rows and returns one value, and with [[GROUP BY]] it returns one per group. The IR peaks split into two kinds: 2492 bands reported by the supplier and 1971 picked from the absorbance at build time. Their means sit 168.5 cm⁻¹ apart — 1702.3 against 1870.8 — because a picker finds weak bands in the fingerprint region that a written list leaves out. Wrap a column in ROUND to keep a printed table readable.',
    sql: `SELECT p.source,
       COUNT(*) AS nb_peaks,
       ROUND(MIN(p.wavenumber), 1) AS lowest,
       ROUND(MAX(p.wavenumber), 1) AS highest,
       ROUND(AVG(p.wavenumber), 1) AS mean
FROM ir_peaks p
GROUP BY p.source`,
    mangoNote:
      'MIN, MAX and AVG have no Mango spelling: a selector decides which documents come back, never what is computed over them.',
  },
  {
    id: 'elemmatch-is-the-join',
    title: '$elemMatch is the join',
    level: 'intermediate',
    description:
      'Ask which compounds are distilled under vacuum and SQL walks two [[foreign key]]s down to `boiling_points`. Mango walks the same path inside one [[document]] with [[$elemMatch]], nested once per level: a listing, whose boiling points, one of which is under 50 mmHg. Both find 106 compounds. The difference is what comes back — SQL returns one row per boiling point, Mango returns the whole compound and leaves you to find the branch that matched.',
    sql: `SELECT c.preferred_name, c.formula, b.low_c, b.pressure_mmhg
FROM boiling_points b
JOIN catalog_entries e ON e.id = b.catalog_entry_id
JOIN compounds c       ON c.id = e.compound_id
WHERE b.pressure_mmhg < 50
ORDER BY b.pressure_mmhg, c.preferred_name
LIMIT 20`,
    mango: `{
  "selector": {
    "listings": {
      "$elemMatch": {
        "boilingPoints": {
          "$elemMatch": { "pressure": { "$lt": 50 } }
        }
      }
    }
  },
  "fields": ["name", "formula", "listings"],
  "limit": 20
}`,
  },
  {
    id: 'nmr-four-level-chain',
    title: 'The NMR chain, four levels deep',
    level: 'advanced',
    description:
      'A 1H spectrum holds ranges, a range holds signals, and a signal holds couplings — four tables, three joins, one row per coupling constant. 7-Bromo-1H-indole returns five rows: the range 6.62–6.68 ppm carries a signal at 6.649 that is a dd with J = 3.16 and 2.21 Hz, the small ortho and meta couplings of the indole 3-position. Drop the last join and you get signals without their J values; drop two and you get ranges. Mango descends the same four levels with [[$elemMatch]] inside [[$elemMatch]].',
    sql: `SELECT c.preferred_name,
       s.solvent,
       ROUND(r.from_ppm, 2) AS range_from,
       ROUND(r.to_ppm, 2)   AS range_to,
       ROUND(g.delta_ppm, 3) AS delta_ppm,
       g.multiplicity,
       ROUND(k.coupling_hz, 2) AS j_hz
FROM nmr_spectra s
JOIN nmr_ranges r    ON r.nmr_spectrum_id = s.id
JOIN nmr_signals g   ON g.nmr_range_id = r.id
JOIN nmr_couplings k ON k.nmr_signal_id = g.id
JOIN compounds c     ON c.id = s.compound_id
WHERE c.preferred_name = '7-Bromo-1H-indole'
ORDER BY delta_ppm, j_hz DESC`,
    mango: `{
  "selector": {
    "nmr": {
      "$elemMatch": {
        "ranges": {
          "$elemMatch": {
            "signals": {
              "$elemMatch": {
                "multiplicity": "dd",
                "couplings": {
                  "$elemMatch": { "coupling": { "$lt": 3 } }
                }
              }
            }
          }
        }
      }
    }
  },
  "fields": ["name", "formula"],
  "limit": 10
}`,
  },
  {
    id: 'reported-versus-picked',
    title: 'Reported bands against picked ones',
    level: 'advanced',
    description:
      'Both kinds of IR band live in `ir_peaks`, told apart by `source`: `reported` is the supplier\'s own list, `picked` was found by ml-gsd when this database was built. `SUM(source = \'reported\')` counts them per spectrum, because a true test is 1 and a false one is 0 — a conditional count with no CASE. Of the 171 spectra, 170 carry both. The Mango side finds the one that does not: [[$allMatch]] asks whether *every* peak is picked, and Nerol is the only answer.',
    sql: `SELECT c.preferred_name,
       SUM(p.source = 'reported') AS reported,
       SUM(p.source = 'picked')   AS picked
FROM ir_spectra s
JOIN ir_peaks p  ON p.ir_spectrum_id = s.id
JOIN compounds c ON c.id = s.compound_id
GROUP BY s.id
ORDER BY reported DESC
LIMIT 15`,
    mango: `{
  "selector": {
    "ir": {
      "$elemMatch": {
        "peaks": { "$allMatch": { "source": "picked" } }
      }
    }
  },
  "fields": ["name", "ir"]
}`,
  },
  {
    id: 'self-join-nearest-band',
    title: 'A self-join, ranked by a window',
    level: 'advanced',
    description:
      'To ask how close the picker came, put the table next to itself in a [[self-join]]: `ir_peaks` under two aliases, joined on the spectrum they share. That pairs each reported band with every picked one, which is too many rows. A [[window function]] numbers the candidates per band by their distance, and `nth = 1` keeps the nearest. Each of Benzaldehyde\'s 19 reported bands finds a picked one, 13 of them within 3 cm⁻¹ — 2737.1 finds 2737.7, the aldehyde C–H stretch, 0.6 apart — while the worst sits 14.6 away, where the picker merged two bands into one.',
    sql: `SELECT preferred_name, reported, nearest_picked, gap
FROM (
  SELECT c.preferred_name,
         ROUND(reported.wavenumber, 1) AS reported,
         ROUND(picked.wavenumber, 1)   AS nearest_picked,
         ROUND(ABS(reported.wavenumber - picked.wavenumber), 1) AS gap,
         ROW_NUMBER() OVER (
           PARTITION BY reported.id
           ORDER BY ABS(reported.wavenumber - picked.wavenumber)
         ) AS nth
  FROM ir_peaks reported
  JOIN ir_peaks picked
    ON picked.ir_spectrum_id = reported.ir_spectrum_id
   AND picked.source = 'picked'
  JOIN ir_spectra s ON s.id = reported.ir_spectrum_id
  JOIN compounds c  ON c.id = s.compound_id
  WHERE reported.source = 'reported'
    AND c.preferred_name = 'Benzaldehyde'
)
WHERE nth = 1
ORDER BY reported DESC`,
    mangoNote:
      'Comparing two elements of the same array against each other has no selector form — Mango tests each element on its own and never sees a pair.',
  },
  {
    id: 'cte-vacuum-distillation',
    title: 'Name a step with WITH',
    level: 'advanced',
    description:
      'A [[CTE]] gives a result a name so the statement can read it twice. `claims` flattens every boiling point onto its compound and pressure; `spread` keeps the 53 compounds claimed at more than one pressure; the final SELECT joins `claims` to itself to put the two ends of the range on one line. DL-2-Phenylpropionic acid drops 145 °C — 260 °C at 760 mmHg, 115 °C at 1 mmHg. Write it without WITH and the flattening is pasted three times.',
    sql: `WITH claims AS (
  SELECT c.id AS compound_id,
         c.preferred_name AS name,
         b.pressure_mmhg,
         MIN(b.low_c) AS low_c
  FROM boiling_points b
  JOIN catalog_entries e ON e.id = b.catalog_entry_id
  JOIN compounds c       ON c.id = e.compound_id
  WHERE b.pressure_mmhg IS NOT NULL AND b.low_c IS NOT NULL
  GROUP BY c.id, b.pressure_mmhg
),
spread AS (
  SELECT compound_id, name,
         COUNT(*) AS nb_pressures,
         MAX(pressure_mmhg) AS highest_mmhg,
         MIN(pressure_mmhg) AS lowest_mmhg
  FROM claims
  GROUP BY compound_id
  HAVING nb_pressures > 1
)
SELECT s.name,
       s.nb_pressures,
       hi.low_c AS bp_at_highest,
       s.highest_mmhg,
       lo.low_c AS bp_at_lowest,
       s.lowest_mmhg,
       ROUND(hi.low_c - lo.low_c, 1) AS drop_c
FROM spread s
JOIN claims hi ON hi.compound_id = s.compound_id AND hi.pressure_mmhg = s.highest_mmhg
JOIN claims lo ON lo.compound_id = s.compound_id AND lo.pressure_mmhg = s.lowest_mmhg
ORDER BY drop_c DESC
LIMIT 15`,
    mangoNote:
      'Naming an intermediate result and reading it twice is a feature of a query language; Mango has one selector and no way to build on it.',
  },
  {
    id: 'where-each-language-stops',
    title: 'Where each one runs out',
    level: 'advanced',
    description:
      'SQL has no natural nesting: the four-level NMR join returns a rectangle, so ethyl tetrahydropyran-4-ylacetate comes back as 11 rows for 1 spectrum, 5 ranges, 6 signals and 11 couplings, its name repeated on every one. Mango has the nesting for free — one [[document]], the whole spectrum inside it — and no [[join]] between documents, no [[aggregate]], no [[HAVING]]. So the question decides the language: counting and combining is SQL, handing a whole compound to a program is Mango. Same 541 compounds, two shapes, and neither shape is the data.',
    sql: `SELECT c.preferred_name,
       COUNT(*)             AS rows_returned,
       COUNT(DISTINCT s.id) AS spectra,
       COUNT(DISTINCT r.id) AS ranges,
       COUNT(DISTINCT g.id) AS signals,
       COUNT(DISTINCT k.id) AS couplings
FROM nmr_spectra s
JOIN nmr_ranges r    ON r.nmr_spectrum_id = s.id
JOIN nmr_signals g   ON g.nmr_range_id = r.id
JOIN nmr_couplings k ON k.nmr_signal_id = g.id
JOIN compounds c     ON c.id = s.compound_id
GROUP BY c.id
ORDER BY rows_returned DESC
LIMIT 10`,
    mango: `{
  "selector": { "name": "ethyl tetrahydropyran-4-ylacetate" },
  "fields": ["name", "nmr"]
}`,
  },
];
