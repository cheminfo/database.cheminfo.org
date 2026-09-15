/**
 * Challenges a student solves by writing a query.
 *
 * Every `solution` and every `mangoSolution` below was run against
 * `public/chem.sqlite` with `scripts/run-query.mjs`, and every `expect` was
 * read off that run. A number here is a measurement, not an estimate.
 *
 * Three exercises repeat, in Mango, a question the student has already answered
 * in SQL — `bromine-compounds-in-mango`, `highly-flammable-in-mango` and
 * `nitrogen-without-oxygen-in-mango`. Both shapes return the same rows, which
 * is the comparison the site exists to make.
 */

import type { BaseExercise } from 'react-cheminfo/core';

/** One thing an attempt is checked against, said in words the student reads. */
export interface ExerciseCase {
  /** What this case checks, one clause. */
  description: string;
}

export interface Exercise extends BaseExercise {
  /** The language an answer is written in; `either` accepts both. */
  language: 'sql' | 'mango' | 'either';
  /**
   * What the editor is preloaded with.
   * @default undefined — the editor opens empty
   */
  starter?: string;
  /**
   * The same answer as a Mango query, when Mango can express it.
   * @default undefined — the exercise is SQL only
   */
  mangoSolution?: string;
  /**
   * The result set the solution produces.
   *
   * A Mango answer is read as a table too: one row per document, the values
   * taken in `fields` order, a dotted path contributing its leaf value. That
   * makes the two tables identical wherever Mango can project what SQL selects.
   * Where it cannot — a count has no selector form — `columns`, `firstRow` and
   * `contains` describe the SQL answer, and the Mango answer is held to
   * `rowCount` and to the order its documents come back in.
   */
  expect: {
    /**
     * The columns an SQL answer must have, in order.
     * @default undefined — the columns are not checked
     */
    columns?: string[];
    /** How many rows the answer has. Exact. */
    rowCount: number;
    /**
     * The first row, when the ordering makes it deterministic.
     * @default undefined — the first row is not checked
     */
    firstRow?: unknown[];
    /**
     * Rows that must appear somewhere in the answer.
     * @default undefined — no row is required by itself
     */
    contains?: unknown[][];
  };
  /**
   * What the checks above mean, for the student to read before running.
   * @default undefined — the expectation is shown as a row count alone
   */
  cases?: readonly ExerciseCase[];
}

/** Every exercise, in the order they are meant to be taken. */
export const EXERCISES: readonly Exercise[] = [
  // ---------------------------------------------------------------- beginner
  {
    id: 'lightest-compounds',
    title: 'The five lightest compounds',
    level: 'beginner',
    language: 'sql',
    description:
      'Return the five lightest compounds, with their name, their formula and their molecular weight. The name and the formula live in `compounds`; the weight is computed from the structure, so it lives in `structures.molecular_weight`, one row per compound, pointing back through `structures.compound_id`. Order the rows so the lightest comes first, and stop at five.',
    starter:
      'SELECT c.preferred_name AS name, c.formula, s.molecular_weight\nFROM compounds c\nJOIN structures s ON ???;',
    hints: [
      'The weight and the name sit in two tables, so the two have to be [[JOIN]]ed.',
      '`structures.compound_id` points back at `compounds.id`, and `ORDER BY` sorts ascending unless you write `DESC`.',
      'Join `ON s.compound_id = c.id`, order by `s.molecular_weight`, and add `LIMIT 5` after the `ORDER BY`, never before it.',
    ],
    solution: `SELECT c.preferred_name AS name, c.formula, s.molecular_weight
FROM compounds c
JOIN structures s ON s.compound_id = c.id
ORDER BY s.molecular_weight
LIMIT 5;`,
    expect: {
      columns: ['name', 'formula', 'molecular_weight'],
      rowCount: 5,
      firstRow: ['Ammonia', 'H3N', 17.0305],
      contains: [['Water', 'H2O', 18.0153]],
    },
    cases: [
      { description: 'exactly five rows come back' },
      { description: 'Ammonia is first, at 17.0305 g/mol' },
      { description: 'Water is in the result' },
    ],
  },
  {
    id: 'ethanol-every-name',
    title: 'Every name ethanol answers to',
    level: 'beginner',
    language: 'sql',
    description:
      'Return every name recorded for Ethanol, each with the language it belongs to. A name lives in `names`, one row per name, and points back at its compound through `compound_id`. Order by language, then by the name itself. Five rows answer this.',
    starter:
      "SELECT n.value, n.language\nFROM names n\nJOIN compounds c ON c.id = n.compound_id\nWHERE c.preferred_name = '???';",
    hints: [
      'A name and a compound sit in two tables, so the two have to be [[JOIN]]ed.',
      '`names.compound_id` is the column that points back at `compounds.id`.',
      "Filter with `WHERE c.preferred_name = 'Ethanol'` and order by `n.language, n.value`.",
    ],
    solution: `SELECT n.value, n.language
FROM names n
JOIN compounds c ON c.id = n.compound_id
WHERE c.preferred_name = 'Ethanol'
ORDER BY n.language, n.value;`,
    expect: {
      columns: ['value', 'language'],
      rowCount: 5,
      firstRow: ['Ethanol', 'de'],
      contains: [
        ['EtOH', 'en'],
        ['Ethylalkohol', 'de'],
      ],
    },
    cases: [
      { description: 'five names come back' },
      { description: 'the German Ethanol is first' },
      { description: 'the abbreviation EtOH is in the result' },
    ],
  },
  {
    id: 'french-names',
    title: 'The French names',
    level: 'beginner',
    language: 'sql',
    description:
      "Return every name whose language is `fr`, next to the compound it belongs to. The `names` table stores a language on each row: 'en', 'de' or 'fr'. Order by compound name, then by the name itself. Nine rows answer this, and some are missing their accents — the source stores them that way, so `Dithyle oxyde` is what a query returns for diethyl ether.",
    starter:
      "SELECT c.preferred_name AS name, n.value\nFROM names n\nJOIN compounds c ON c.id = n.compound_id\nWHERE n.language = '??';",
    hints: [
      'The language is a plain text column, so a plain equality filters it.',
      "Write `WHERE n.language = 'fr'` and order by `c.preferred_name, n.value`.",
    ],
    solution: `SELECT c.preferred_name AS name, n.value
FROM names n
JOIN compounds c ON c.id = n.compound_id
WHERE n.language = 'fr'
ORDER BY c.preferred_name, n.value;`,
    expect: {
      columns: ['name', 'value'],
      rowCount: 9,
      firstRow: ['2-Propanol', 'Alcool isopropylique'],
      contains: [
        ['Ether', 'Dithyle oxyde'],
        ['Glycine', 'Glycocolle'],
      ],
    },
    cases: [
      { description: 'nine French names come back' },
      { description: "2-Propanol's Alcool isopropylique is first" },
      { description: 'the accent-stripped Dithyle oxyde is in the result' },
    ],
  },
  {
    id: 'bromine-compounds',
    title: 'Everything that carries bromine',
    level: 'beginner',
    language: 'sql',
    description:
      'Return every compound whose formula contains bromine, with its name and its formula, ordered by name. A formula is a string such as `C8H9BrO`, so the question is a pattern match on `compounds.formula`. SQLite has two: `LIKE` ignores case and writes `%` for any run of characters, `GLOB` keeps case and writes `*`. Thirty compounds answer this, 2,3,5-Tribromothiophene among them.',
    starter:
      "SELECT preferred_name AS name, formula\nFROM compounds\nWHERE formula GLOB '??';",
    hints: [
      'The element is part of the formula text, so a pattern on `formula` finds it.',
      '`GLOB` matches case exactly and writes `*` for any run of characters, where `LIKE` writes `%`.',
      "Write the whole symbol, `WHERE formula GLOB '*Br*'` — `'*B*'` would also catch boron — and order by `preferred_name`.",
    ],
    solution: `SELECT preferred_name AS name, formula
FROM compounds
WHERE formula GLOB '*Br*'
ORDER BY preferred_name;`,
    expect: {
      columns: ['name', 'formula'],
      rowCount: 30,
      firstRow: ['1-(4-Bromophenyl)ethanol', 'C8H9BrO'],
      contains: [['2,3,5-Tribromothiophene', 'C4HBr3S']],
    },
    cases: [
      { description: 'thirty compounds carry bromine' },
      { description: '1-(4-Bromophenyl)ethanol is first' },
      { description: '2,3,5-Tribromothiophene, three bromines in C4HBr3S, is in the result' },
    ],
  },
  {
    id: 'bromine-compounds-in-mango',
    title: 'Bromine again, as a selector',
    level: 'beginner',
    language: 'mango',
    description:
      'Ask the question you just answered in SQL, this time in Mango. A document carries the same formula string, and `$regex` is the selector’s pattern match: it matches anywhere unless anchored, so no wildcard is written. Return the name and the formula, sorted by name. A sort needs its field in the selector as well, because CouchDB and PouchDB refuse to sort on a field the selector does not mention. The same thirty compounds come back.',
    starter: '{\n  "selector": {},\n  "fields": ["name", "formula"]\n}',
    hints: [
      'The [[selector]] names a field and says what it must satisfy.',
      '`{"$regex": "Br"}` matches a string holding Br anywhere — no `*` or `%` is needed.',
      'Sort with `"sort": [{ "name": "asc" }]`, and add `"name": { "$gt": null }` to the selector so the sort has its field.',
    ],
    solution: `SELECT preferred_name AS name, formula
FROM compounds
WHERE formula GLOB '*Br*'
ORDER BY preferred_name;`,
    mangoSolution: `{
  "selector": {
    "name": { "$gt": null },
    "formula": { "$regex": "Br" }
  },
  "fields": ["name", "formula"],
  "sort": [{ "name": "asc" }]
}`,
    expect: {
      rowCount: 30,
      firstRow: ['1-(4-Bromophenyl)ethanol', 'C8H9BrO'],
      contains: [['2,3,5-Tribromothiophene', 'C4HBr3S']],
    },
    cases: [
      { description: 'thirty documents match, the same thirty the SQL returned' },
      { description: '1-(4-Bromophenyl)ethanol is first' },
      { description: 'the selector names `name`, the field the sort runs on' },
    ],
  },
  {
    id: 'light-molecules',
    title: 'Under fifty grams per mole',
    level: 'beginner',
    language: 'mango',
    description:
      'Return every compound lighter than 50 g/mol, with its name, its formula and its mass, lightest first. A document carries the weight on the compound itself and calls it `mass`, where the tables keep it in `structures.molecular_weight` — the two shapes place and name the same number differently. Nine compounds answer this. Water and ammonia are among them.',
    starter: '{\n  "selector": { "mass": {} },\n  "fields": ["name", "formula", "mass"]\n}',
    hints: [
      'Mango compares with named operators rather than symbols.',
      '`$lt` is strictly less than; `$lte` would also take a compound at exactly 50.',
      '`"sort": [{ "mass": "asc" }]` puts the lightest first.',
    ],
    solution: `SELECT c.preferred_name AS name, c.formula, s.molecular_weight AS mass
FROM compounds c
JOIN structures s ON s.compound_id = c.id
WHERE s.molecular_weight < 50
ORDER BY s.molecular_weight;`,
    mangoSolution: `{
  "selector": { "mass": { "$lt": 50 } },
  "fields": ["name", "formula", "mass"],
  "sort": [{ "mass": "asc" }]
}`,
    expect: {
      rowCount: 9,
      firstRow: ['Ammonia', 'H3N', 17.0305],
      contains: [
        ['Water', 'H2O', 18.0153],
        ['Acetonitrile', 'CH3CN', 41.0525],
      ],
    },
    cases: [
      { description: 'nine documents match' },
      { description: 'Ammonia is first, at 17.0305 g/mol' },
      { description: 'Acetonitrile is in the result' },
    ],
  },
  {
    id: 'listings-per-supplier',
    title: 'How many listings each supplier has',
    level: 'beginner',
    language: 'sql',
    description:
      'Return one row per supplier with the number of catalogue entries they list, busiest first. A [[listing]] is one supplier\'s entry for one compound, so counting rows in `catalog_entries` counts listings. Three rows answer this, over 1049 listings in all. The `reference` supplier is not a shop: it is the record the catalogue itself keeps, and it accounts for 769 of them.',
    starter: 'SELECT supplier, COUNT(*) AS nb_listings\nFROM catalog_entries;',
    hints: [
      'A count per something is a [[GROUP BY]] on that something.',
      '`COUNT(*)` counts the rows in each group.',
      'Group by `supplier` and order by the count descending.',
    ],
    solution: `SELECT supplier, COUNT(*) AS nb_listings
FROM catalog_entries
GROUP BY supplier
ORDER BY nb_listings DESC;`,
    expect: {
      columns: ['supplier', 'nb_listings'],
      rowCount: 3,
      firstRow: ['reference', 769],
      contains: [
        ['AcrosOrganics', 170],
        ['MaybridgeBB', 110],
      ],
    },
    cases: [
      { description: 'three groups come back' },
      { description: 'reference is the largest, with 769 listings' },
      { description: 'the three counts add up to 1049, the whole table' },
    ],
  },

  // ------------------------------------------------------------ intermediate
  {
    id: 'flash-point-below-zero',
    title: 'Flash points below zero',
    level: 'intermediate',
    language: 'sql',
    description:
      'Return every flash point recorded below 0 °C, with the compound it was measured on, coldest first. A flash point hangs off a [[listing]], not off a compound, so two joins stand between `flash_points` and `compounds`. Twelve rows answer this. Ethanethiol flashes at −45 °C, the lowest in the database.',
    starter:
      'SELECT c.preferred_name AS name, f.low_c\nFROM flash_points f\nJOIN catalog_entries e ON e.id = f.catalog_entry_id\nJOIN compounds c ON c.id = ???;',
    hints: [
      'A flash point knows its catalogue entry, and a catalogue entry knows its compound.',
      '`flash_points.catalog_entry_id` reaches `catalog_entries.id`; `catalog_entries.compound_id` reaches `compounds.id`.',
      'Filter `f.low_c < 0` and order by `f.low_c, c.preferred_name`.',
    ],
    solution: `SELECT c.preferred_name AS name, f.low_c
FROM flash_points f
JOIN catalog_entries e ON e.id = f.catalog_entry_id
JOIN compounds c ON c.id = e.compound_id
WHERE f.low_c < 0
ORDER BY f.low_c, c.preferred_name;`,
    expect: {
      columns: ['name', 'low_c'],
      rowCount: 12,
      firstRow: ['Ethanethiol', -45],
      contains: [
        ['Acetone', -20],
        ['Cycloheptene', -6],
      ],
    },
    cases: [
      { description: 'twelve flash points fall below 0 °C' },
      { description: 'Ethanethiol is first, at −45 °C' },
      { description: 'Acetone appears at −20 °C' },
    ],
  },
  {
    id: 'many-names',
    title: 'Compounds with more than ten names',
    level: 'intermediate',
    language: 'sql',
    description:
      'Return one row per compound with the number of names it carries, keeping only those with more than ten, most names first. `names` holds one row per name, so the count is a [[GROUP BY]] over that table. A count cannot be filtered in `WHERE`, because `WHERE` runs before the grouping — [[HAVING]] runs after it. Thirty compounds answer this; Glucan carries 49.',
    starter:
      'SELECT c.preferred_name AS name, COUNT(n.id) AS nb_names\nFROM compounds c\nJOIN names n ON n.compound_id = c.id\nGROUP BY c.id;',
    hints: [
      'The filter is on a count, so it cannot sit in `WHERE`.',
      '`HAVING` takes the same expressions as `WHERE`, but after the groups are formed.',
      'Write `HAVING nb_names > 10` and order by `nb_names DESC, c.preferred_name`.',
    ],
    solution: `SELECT c.preferred_name AS name, COUNT(n.id) AS nb_names
FROM compounds c
JOIN names n ON n.compound_id = c.id
GROUP BY c.id
HAVING nb_names > 10
ORDER BY nb_names DESC, c.preferred_name;`,
    expect: {
      columns: ['name', 'nb_names'],
      rowCount: 30,
      firstRow: ['Glucan', 49],
      contains: [
        ['Iditol', 36],
        ['2-Propanol', 12],
      ],
    },
    cases: [
      { description: 'thirty compounds carry more than ten names' },
      { description: 'Glucan is first, with 49' },
      { description: '2-Propanol appears with 12' },
    ],
  },
  {
    id: 'highly-flammable',
    title: 'Whatever is labelled H225',
    level: 'intermediate',
    language: 'sql',
    description:
      'Return every compound carrying the GHS hazard code H225, "highly flammable liquid and vapor", with its name and formula. A hazard hangs off a [[listing]], so the same compound can reach you through several entries — return each compound once. `hazard_statements.system` separates the vocabularies, and H225 lives in `ghs-hazard`. Seventeen compounds answer this.',
    starter:
      "SELECT c.preferred_name AS name, c.formula\nFROM hazard_statements h\nJOIN catalog_entries e ON e.id = h.catalog_entry_id\nJOIN compounds c ON c.id = e.compound_id\nWHERE h.code = 'H225';",
    hints: [
      'Two listings of the same compound can both carry H225, which duplicates the compound.',
      '`SELECT DISTINCT` collapses the duplicates once the columns are only name and formula.',
      "Filter on both `h.system = 'ghs-hazard'` and `h.code = 'H225'`, then order by `c.preferred_name`.",
    ],
    solution: `SELECT DISTINCT c.preferred_name AS name, c.formula
FROM hazard_statements h
JOIN catalog_entries e ON e.id = h.catalog_entry_id
JOIN compounds c ON c.id = e.compound_id
WHERE h.system = 'ghs-hazard' AND h.code = 'H225'
ORDER BY c.preferred_name;`,
    expect: {
      columns: ['name', 'formula'],
      rowCount: 17,
      firstRow: ['2-Propanol', 'C3H8O'],
      contains: [
        ['Acetone', 'C3H6O'],
        ['Ethanol', 'C2H6O'],
        ['Toluene', 'C7H8'],
      ],
    },
    cases: [
      { description: 'seventeen compounds carry H225' },
      { description: '2-Propanol is first' },
      { description: 'each compound appears once, Ethanol included' },
    ],
  },
  {
    id: 'highly-flammable-in-mango',
    title: 'H225 again, through two $elemMatch',
    level: 'intermediate',
    language: 'mango',
    description:
      'Ask the H225 question again, this time in Mango. A document nests its listings, and each listing nests its hazards, so the condition has to reach two levels down an array. [[$elemMatch]] asks whether *some* element of an array satisfies a selector, which is what "any listing, any hazard" means. Return the name and formula sorted by name; the same seventeen compounds come back, already deduplicated because a document is one compound.',
    starter: '{\n  "selector": {\n    "listings": { "$elemMatch": {} }\n  },\n  "fields": ["name", "formula"]\n}',
    hints: [
      'The path `listings.hazards.code` crosses two arrays, and a dotted path does not.',
      '`$elemMatch` takes a selector and applies it to each element of the array.',
      'Nest one `$elemMatch` on `listings` and another on `hazards`, matching `{"code": "H225"}`.',
    ],
    solution: `SELECT DISTINCT c.preferred_name AS name, c.formula
FROM hazard_statements h
JOIN catalog_entries e ON e.id = h.catalog_entry_id
JOIN compounds c ON c.id = e.compound_id
WHERE h.system = 'ghs-hazard' AND h.code = 'H225'
ORDER BY c.preferred_name;`,
    mangoSolution: `{
  "selector": {
    "name": { "$gt": null },
    "listings": {
      "$elemMatch": {
        "hazards": { "$elemMatch": { "code": "H225" } }
      }
    }
  },
  "fields": ["name", "formula"],
  "sort": [{ "name": "asc" }]
}`,
    expect: {
      rowCount: 17,
      firstRow: ['2-Propanol', 'C3H8O'],
      contains: [
        ['Acetone', 'C3H6O'],
        ['Ethanol', 'C2H6O'],
      ],
    },
    cases: [
      { description: 'seventeen documents match, the same seventeen the SQL returned' },
      { description: '2-Propanol is first' },
      { description: 'no DISTINCT is needed — a document is already one compound' },
    ],
  },
  {
    id: 'nitrogen-without-oxygen',
    title: 'Nitrogen but no oxygen',
    level: 'intermediate',
    language: 'sql',
    description:
      'Return every compound that contains nitrogen and contains no oxygen, with its name and formula, ordered by name. The formula answers both halves, but a symbol is not a letter: `N` also begins `Ni` and `Na`, so N only counts when the character after it is not a lowercase letter. `GLOB` takes a character class such as `[^a-z]`, and `NOT` turns the oxygen match into an absence. Seventy-six compounds answer this.',
    starter:
      "SELECT preferred_name AS name, formula\nFROM compounds\nWHERE formula GLOB '*N*';",
    hints: [
      "`'*N*'` also finds the N of `Ni`, so Nickel slips in — and `LIKE '%N%'` ignores case, so it finds the n of `Sn` too.",
      "`[^a-z]` is one character that is not a lowercase letter, so `'*N[^a-z]*'` is N followed by a digit or by the next symbol.",
      "A formula can end on the symbol, as C15H17N does, so pair it with `'*N'`: `(formula GLOB '*N[^a-z]*' OR formula GLOB '*N')`, then write the same pair for O inside `NOT (...)`.",
    ],
    solution: `SELECT preferred_name AS name, formula
FROM compounds
WHERE (formula GLOB '*N[^a-z]*' OR formula GLOB '*N')
  AND NOT (formula GLOB '*O[^a-z]*' OR formula GLOB '*O')
ORDER BY preferred_name;`,
    expect: {
      columns: ['name', 'formula'],
      rowCount: 76,
      firstRow: ['(R)-(+)-N-Benzyl-alpha-methylbenzylamine', 'C15H17N'],
      contains: [
        ['1,2-Diaminocyclohexane', 'C6H14N2'],
        ['2,6-Difluorobenzonitrile', 'C7H3F2N'],
      ],
    },
    cases: [
      { description: 'seventy-six compounds carry nitrogen and no oxygen' },
      { description: '(R)-(+)-N-Benzyl-alpha-methylbenzylamine is first' },
      { description: 'Nickel, whose formula is Ni, is not in the result' },
    ],
  },
  {
    id: 'nitrogen-without-oxygen-in-mango',
    title: 'Nitrogen but no oxygen, as a selector',
    level: 'intermediate',
    language: 'mango',
    description:
      'Ask the previous question again in Mango. `$regex` finds a symbol in the formula string, and one pattern covers both of the GLOB cases: `N([^a-z]|$)` is N followed by anything but a lowercase letter, or by the end. `$not` takes a whole selector and keeps the documents it rejects, and it sits beside the other keys with no `$and` to write. Return the name and formula sorted by name; the same seventy-six compounds come back.',
    starter:
      '{\n  "selector": {\n    "formula": { "$regex": "N" }\n  },\n  "fields": ["name", "formula"]\n}',
    hints: [
      'A bare `"N"` matches the N of `Ni` as well — the character after the symbol decides.',
      '`([^a-z]|$)` means "not a lowercase letter, or the end of the string", one pattern where GLOB needed two.',
      'Add `"$not": { "formula": { "$regex": "O([^a-z]|$)" } }` beside the nitrogen condition, and `"name": { "$gt": null }` so the sort on name has its field.',
    ],
    solution: `SELECT preferred_name AS name, formula
FROM compounds
WHERE (formula GLOB '*N[^a-z]*' OR formula GLOB '*N')
  AND NOT (formula GLOB '*O[^a-z]*' OR formula GLOB '*O')
ORDER BY preferred_name;`,
    mangoSolution: `{
  "selector": {
    "name": { "$gt": null },
    "formula": { "$regex": "N([^a-z]|$)" },
    "$not": { "formula": { "$regex": "O([^a-z]|$)" } }
  },
  "fields": ["name", "formula"],
  "sort": [{ "name": "asc" }]
}`,
    expect: {
      rowCount: 76,
      firstRow: ['(R)-(+)-N-Benzyl-alpha-methylbenzylamine', 'C15H17N'],
      contains: [['1,2-Diaminocyclohexane', 'C6H14N2']],
    },
    cases: [
      { description: 'seventy-six documents match, the same seventy-six the SQL returned' },
      { description: '(R)-(+)-N-Benzyl-alpha-methylbenzylamine is first' },
      { description: 'dropping the `$not` clause raises the count to 254' },
    ],
  },
  {
    id: 'three-cas-numbers',
    title: 'Exactly three CAS numbers',
    level: 'intermediate',
    language: 'either',
    description:
      'Return every compound registered under exactly three CAS numbers, with its name and how many it has, ordered by name. SQL counts rows in `cas_numbers` and filters the count with [[HAVING]]; Mango reads the length of the `cas` array with [[$size]]. Thirty-eight compounds answer this. Write it in whichever language you like, then write it in the other.',
    starter:
      'SELECT c.preferred_name AS name, COUNT(k.id) AS nb_cas\nFROM compounds c\nJOIN cas_numbers k ON k.compound_id = c.id\nGROUP BY c.id;',
    hints: [
      'In SQL the count is formed by the grouping, so the filter comes after it.',
      'In Mango the count is a property of the array itself, so no grouping exists.',
      '`HAVING nb_cas = 3` on one side, `{"cas": {"$size": 3}}` on the other.',
    ],
    solution: `SELECT c.preferred_name AS name, COUNT(k.id) AS nb_cas
FROM compounds c
JOIN cas_numbers k ON k.compound_id = c.id
GROUP BY c.id
HAVING nb_cas = 3
ORDER BY c.preferred_name;`,
    mangoSolution: `{
  "selector": {
    "name": { "$gt": null },
    "cas": { "$size": 3 }
  },
  "fields": ["name", "cas"],
  "sort": [{ "name": "asc" }]
}`,
    expect: {
      columns: ['name', 'nb_cas'],
      rowCount: 38,
      firstRow: ['1-(4-Bromophenyl)ethanol', 3],
      contains: [
        ['1-Octyn-3-ol', 3],
        ['D-Tyrosine', 3],
      ],
    },
    cases: [
      { description: 'thirty-eight compounds have exactly three CAS numbers' },
      { description: '1-(4-Bromophenyl)ethanol is first' },
      { description: 'raising the bound to five or more leaves nine compounds' },
      {
        description:
          'the Mango answer returns the three numbers themselves, because no selector computes a count',
      },
    ],
  },
  {
    id: 'boiling-point-pressures',
    title: 'How many pressures a boiling point was taken at',
    level: 'intermediate',
    language: 'sql',
    description:
      'Return one row per compound with the number of distinct pressures its boiling points were measured at, keeping only compounds with two or more, most pressures first. A boiling point belongs to a [[listing]] and carries its own `pressure_mmhg`, which is why one compound holds several. Count the distinct pressures, not the rows — two listings often repeat 760 mmHg. Fifty-three compounds answer this, and four of them were measured at three pressures.',
    starter:
      'SELECT c.preferred_name AS name, COUNT(???) AS nb_pressures\nFROM compounds c\nJOIN catalog_entries e ON e.compound_id = c.id\nJOIN boiling_points b ON b.catalog_entry_id = e.id\nGROUP BY c.id;',
    hints: [
      'Counting rows overcounts, because two suppliers can both report 760 mmHg.',
      '`COUNT(DISTINCT b.pressure_mmhg)` counts each pressure once.',
      'Add `HAVING nb_pressures >= 2` and order by `nb_pressures DESC, c.preferred_name`.',
    ],
    solution: `SELECT c.preferred_name AS name, COUNT(DISTINCT b.pressure_mmhg) AS nb_pressures
FROM compounds c
JOIN catalog_entries e ON e.compound_id = c.id
JOIN boiling_points b ON b.catalog_entry_id = e.id
GROUP BY c.id
HAVING nb_pressures >= 2
ORDER BY nb_pressures DESC, c.preferred_name;`,
    expect: {
      columns: ['name', 'nb_pressures'],
      rowCount: 53,
      firstRow: ['1,2-Diaminocyclohexane', 3],
      contains: [
        ['Solketal', 3],
        ['DL-1-(2-Furyl)ethanol', 3],
      ],
    },
    cases: [
      { description: 'fifty-three compounds were boiled at two pressures or more' },
      { description: '1,2-Diaminocyclohexane is first, with three' },
      { description: 'counting rows instead of distinct pressures inflates the count' },
    ],
  },

  // ---------------------------------------------------------------- advanced
  {
    id: 'vacuum-distillation',
    title: 'The same liquid, boiled under vacuum',
    level: 'advanced',
    language: 'sql',
    description:
      'Return every boiling point recorded below atmospheric pressure for a compound that also has one at 760 mmHg, with the compound, the pressure and the temperature. The reduced-pressure rows only mean something next to the atmospheric one, so the atmospheric row is a condition on the compound, not a row to return. Order by name, then pressure, then temperature. Forty-nine rows answer this: 1,2-Diaminocyclohexane boils at 188 °C at 760 mmHg, 104 °C at 40 mmHg and 79 °C at 15 mmHg.',
    starter:
      'SELECT c.preferred_name AS name, b.pressure_mmhg, b.low_c\nFROM boiling_points b\nJOIN catalog_entries e ON e.id = b.catalog_entry_id\nJOIN compounds c ON c.id = e.compound_id\nWHERE b.pressure_mmhg < 760;',
    hints: [
      'Two conditions apply to different rows: one to the row you return, one to the compound.',
      'A correlated `EXISTS` checks the second without adding it to the output.',
      'Inside the `EXISTS`, join `boiling_points` to `catalog_entries` again and correlate on `e2.compound_id = c.id`.',
    ],
    solution: `SELECT c.preferred_name AS name, b.pressure_mmhg, b.low_c
FROM boiling_points b
JOIN catalog_entries e ON e.id = b.catalog_entry_id
JOIN compounds c ON c.id = e.compound_id
WHERE b.pressure_mmhg < 760
  AND EXISTS (SELECT 1
              FROM boiling_points b2
              JOIN catalog_entries e2 ON e2.id = b2.catalog_entry_id
              WHERE e2.compound_id = c.id AND b2.pressure_mmhg = 760)
ORDER BY c.preferred_name, b.pressure_mmhg, b.low_c;`,
    expect: {
      columns: ['name', 'pressure_mmhg', 'low_c'],
      rowCount: 49,
      firstRow: ['(R)-(+)-N-Benzyl-alpha-methylbenzylamine', 3, 129],
      contains: [
        ['1,2-Diaminocyclohexane', 15, 79],
        ['1,2-Diaminocyclohexane', 40, 104],
      ],
    },
    cases: [
      { description: 'forty-nine reduced-pressure boiling points come back' },
      { description: '1,2-Diaminocyclohexane appears at both 15 and 40 mmHg' },
      { description: 'no row in the result sits at 760 mmHg' },
    ],
  },
  {
    id: 'picked-beats-reported',
    title: 'Where peak picking found more than the supplier reported',
    level: 'advanced',
    language: 'sql',
    description:
      'Return one row per IR spectrum with its compound, its source id, how many bands the supplier reported and how many this build picked, keeping only the spectra where picking found more. `ir_peaks.source` is `reported` or `picked`, and both live in the same table. Count each kind inside one grouping rather than joining the table to itself. Thirty-five spectra answer this; Nerol has twelve picked bands and no reported ones.',
    starter:
      "SELECT c.preferred_name AS name, s.source_id,\n       SUM(p.source = 'reported') AS reported,\n       SUM(???) AS picked\nFROM ir_spectra s\nJOIN ir_peaks p ON p.ir_spectrum_id = s.id\nJOIN compounds c ON c.id = s.compound_id\nGROUP BY s.id;",
    hints: [
      'A comparison in SQLite evaluates to 1 or 0, so it can be summed.',
      "`SUM(p.source = 'picked')` counts the picked rows inside each group.",
      'Group by `s.id`, not by the compound — a compound can have several spectra — and filter with `HAVING picked > reported`.',
    ],
    solution: `SELECT c.preferred_name AS name, s.source_id,
       SUM(p.source = 'reported') AS reported,
       SUM(p.source = 'picked') AS picked
FROM ir_spectra s
JOIN ir_peaks p ON p.ir_spectrum_id = s.id
JOIN compounds c ON c.id = s.compound_id
GROUP BY s.id
HAVING picked > reported
ORDER BY picked - reported DESC, c.preferred_name;`,
    expect: {
      columns: ['name', 'source_id', 'reported', 'picked'],
      rowCount: 35,
      firstRow: ['Nerol', '12673', 0, 12],
      contains: [
        ['m-Cresol', '637', 12, 19],
        ['Benzaldehyde', '229', 19, 22],
      ],
    },
    cases: [
      { description: 'thirty-five spectra have more picked bands than reported ones' },
      { description: 'Nerol is first, with 0 reported and 12 picked' },
      { description: 'grouping by compound instead of spectrum changes the counts' },
    ],
  },
  {
    id: 'doublet-of-doublets',
    title: 'Every dd, with its two couplings',
    level: 'advanced',
    language: 'sql',
    description:
      'Return every NMR signal recorded as a `dd`, with its compound, its shift and its two [[coupling constant]]s, largest first within the signal. The chain is spectrum → range → signal → coupling, four joins deep, and the two couplings are two rows you have to bring onto one line. Round the shift to three decimals and the couplings to two. Twenty-six signals answer this; 7-Bromo-1H-indole has a dd at 6.649 ppm with J = 3.16 and 2.21 Hz.',
    starter:
      "SELECT c.preferred_name AS name, sg.delta_ppm\nFROM nmr_signals sg\nJOIN nmr_couplings cp ON cp.nmr_signal_id = sg.id\nJOIN nmr_ranges r ON r.id = sg.nmr_range_id\nJOIN nmr_spectra sp ON sp.id = r.nmr_spectrum_id\nJOIN compounds c ON c.id = sp.compound_id\nWHERE sg.multiplicity = 'dd';",
    hints: [
      'Joining the couplings gives you two rows per signal, and the answer wants one.',
      'Group by the signal, then take an [[aggregate]] of the coupling on each side.',
      '`MAX(cp.coupling_hz)` and `MIN(cp.coupling_hz)` inside `GROUP BY sg.id` collapse the pair.',
    ],
    solution: `SELECT c.preferred_name AS name,
       ROUND(sg.delta_ppm, 3) AS delta_ppm,
       ROUND(MAX(cp.coupling_hz), 2) AS large_j,
       ROUND(MIN(cp.coupling_hz), 2) AS small_j
FROM nmr_signals sg
JOIN nmr_couplings cp ON cp.nmr_signal_id = sg.id
JOIN nmr_ranges r ON r.id = sg.nmr_range_id
JOIN nmr_spectra sp ON sp.id = r.nmr_spectrum_id
JOIN compounds c ON c.id = sp.compound_id
WHERE sg.multiplicity = 'dd'
GROUP BY sg.id
ORDER BY c.preferred_name, delta_ppm;`,
    expect: {
      columns: ['name', 'delta_ppm', 'large_j', 'small_j'],
      rowCount: 26,
      firstRow: ['3-(2-Furyl)aniline', 6.459, 3.34, 1.8],
      contains: [
        ['7-Bromo-1H-indole', 6.649, 3.16, 2.21],
        ['3-Thenoic acid', 7.435, 5.04, 1.18],
      ],
    },
    cases: [
      { description: 'twenty-six dd signals come back, one row each' },
      { description: '7-Bromo-1H-indole reports J = 3.16 and 2.21 Hz at 6.649 ppm' },
      { description: 'dropping the GROUP BY doubles the row count to 52' },
    ],
  },
  {
    id: 'partial-ghs',
    title: 'Where only some listings carry a GHS hazard',
    level: 'advanced',
    language: 'sql',
    description:
      'Return one row per compound with how many listings it has and how many of those declare a GHS hazard, keeping only compounds where the two numbers differ and the second is not zero. A hazard is a claim a supplier makes, so silence in one listing is not safety — it is a listing that carries the older risk-phrase vocabulary, or none at all. Order by number of listings, then by name. One hundred and eighty-three compounds answer this; Ethanol has two listings and one GHS block.',
    starter:
      "SELECT c.preferred_name AS name, COUNT(*) AS nb_listings\nFROM compounds c\nJOIN catalog_entries e ON e.compound_id = c.id\nGROUP BY c.id;",
    hints: [
      'Whether a listing has a GHS block is a yes-or-no per listing, so it can be summed per compound.',
      'A correlated `EXISTS` inside `SUM(...)` evaluates to 1 or 0 for each listing row.',
      'Keep the groups where `nb_with_ghs > 0 AND nb_with_ghs < nb_listings`.',
    ],
    solution: `SELECT c.preferred_name AS name,
       COUNT(*) AS nb_listings,
       SUM(EXISTS (SELECT 1 FROM hazard_statements h
                   WHERE h.catalog_entry_id = e.id
                     AND h.system = 'ghs-hazard')) AS nb_with_ghs
FROM compounds c
JOIN catalog_entries e ON e.compound_id = c.id
GROUP BY c.id
HAVING nb_with_ghs > 0 AND nb_with_ghs < nb_listings
ORDER BY nb_listings DESC, c.preferred_name;`,
    expect: {
      columns: ['name', 'nb_listings', 'nb_with_ghs'],
      rowCount: 183,
      firstRow: ['DL-Menthol', 10, 1],
      contains: [
        ['DL-Camphor', 7, 1],
        ['Ethanol', 2, 1],
        ['Acetone', 2, 1],
      ],
    },
    cases: [
      { description: 'one hundred and eighty-three compounds are labelled unevenly' },
      { description: 'DL-Menthol is first: ten listings, one GHS block' },
      { description: 'Ethanol appears with two listings and one GHS block' },
    ],
  },
  {
    id: 'dmso-doublet-of-doublets',
    title: 'A dd in DMSO, three arrays down',
    level: 'advanced',
    language: 'mango',
    description:
      'Return every compound with a `1H` spectrum run in DMSO that contains a signal recorded as a `dd`, with its name and formula, sorted by name. The document nests spectrum → ranges → signals, so the condition crosses three arrays, and both halves must hold on the *same* spectrum. [[$elemMatch]] is what keeps them together: two separate conditions would accept a DMSO spectrum and a dd in a different one. Four compounds answer this — the SQL twin is the four-join walk you wrote for the dd exercise, plus a solvent filter.',
    starter:
      '{\n  "selector": {\n    "nmr": { "$elemMatch": { "solvent": "DMSO" } }\n  },\n  "fields": ["name", "formula"]\n}',
    hints: [
      'A dotted path cannot step through an array, and there are three of them here.',
      'Each array level takes its own `$elemMatch`, nested inside the previous one.',
      'Put `solvent` and the `ranges` condition in the same `$elemMatch`, so one spectrum satisfies both.',
    ],
    solution: `SELECT DISTINCT c.preferred_name AS name, c.formula
FROM nmr_spectra sp
JOIN nmr_ranges r ON r.nmr_spectrum_id = sp.id
JOIN nmr_signals sg ON sg.nmr_range_id = r.id
JOIN compounds c ON c.id = sp.compound_id
WHERE sp.solvent = 'DMSO' AND sg.multiplicity = 'dd'
ORDER BY c.preferred_name;`,
    mangoSolution: `{
  "selector": {
    "name": { "$gt": null },
    "nmr": {
      "$elemMatch": {
        "solvent": "DMSO",
        "ranges": {
          "$elemMatch": {
            "signals": { "$elemMatch": { "multiplicity": "dd" } }
          }
        }
      }
    }
  },
  "fields": ["name", "formula"],
  "sort": [{ "name": "asc" }]
}`,
    expect: {
      rowCount: 4,
      firstRow: ['3-Thenoic acid', 'C5H4O2S'],
      contains: [
        ['Chromane-2-carboxylic acid', 'C10H10O3'],
        ['isoquinoline-4-carboxylic acid', 'C10H7NO2'],
      ],
    },
    cases: [
      { description: 'four documents match' },
      { description: '3-Thenoic acid is first' },
      { description: 'the SQL twin returns the same four compounds' },
    ],
  },
];
