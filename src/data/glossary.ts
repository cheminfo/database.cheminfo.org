/**
 * The words a tutorial step is allowed to lean on.
 *
 * A description writes `[[join]]` around a term and the renderer resolves it
 * here, case-insensitively. A term that is not in this record renders as plain
 * text, so a step may mark a word before its entry exists.
 */

import type { Glossary } from 'react-cheminfo/core';

/** Every term the tutorial marks, keyed lowercase. */
export const GLOSSARY: Glossary = {
  'primary key': {
    title: 'Primary key',
    summary:
      'The column that names one row and never repeats. Every table here has `id`, and a row is reachable by it alone.',
    examples: [
      {
        code: 'SELECT preferred_name FROM compounds WHERE id = 295',
        note: 'Returns 1,2-Diaminocyclohexane, and can never return two rows.',
      },
      {
        code: 'catalog_entries.entry_id',
        note: 'A second unique column: the supplier’s own listing number.',
      },
    ],
  },
  'foreign key': {
    title: 'Foreign key',
    summary:
      'A column holding another table’s primary key. It is what a join follows, and it points one way: the child names its parent.',
    examples: [
      {
        code: 'boiling_points.catalog_entry_id -> catalog_entries.id',
        note: 'A boiling point names the listing that claims it.',
      },
      {
        code: 'ir_peaks.ir_spectrum_id -> ir_spectra.id',
        note: '4463 peaks point at 171 spectra.',
      },
    ],
  },
  join: {
    title: 'JOIN',
    summary:
      'Pairs each row of one table with the rows of another that match a condition. A row appears only when both sides have a partner.',
    examples: [
      {
        code: 'FROM boiling_points b JOIN catalog_entries e ON e.id = b.catalog_entry_id',
        note: 'Turns 558 boiling points into 558 rows carrying their listing.',
      },
      {
        code: 'FROM compounds c JOIN names n ON n.compound_id = c.id',
        note: '2033 rows, because a compound with 12 names appears 12 times.',
      },
    ],
  },
  'left join': {
    title: 'LEFT JOIN',
    summary:
      'Keeps every row of the left table even when the right one has no match, and fills the missing columns with NULL. Use it to find what is absent.',
    examples: [
      {
        code: 'FROM compounds c LEFT JOIN ir_spectra s ON s.compound_id = c.id WHERE s.id IS NULL',
        note: 'The 370 compounds with no IR spectrum.',
      },
      {
        code: 'JOIN instead of LEFT JOIN',
        note: 'Drops those 370 rows silently — the absent side is never reported.',
      },
    ],
  },
  'self-join': {
    title: 'Self-join',
    summary:
      'Joins a table to itself under two aliases, so a row can be compared with its neighbours. The aliases are what keep the two copies apart.',
    examples: [
      {
        code: "FROM ir_peaks reported JOIN ir_peaks picked ON picked.ir_spectrum_id = reported.ir_spectrum_id",
        note: 'Puts every reported band next to every picked band of the same spectrum.',
      },
    ],
  },
  'group by': {
    title: 'GROUP BY',
    summary:
      'Folds rows that share a value into one row, so an aggregate can be computed per group. Every column you select is either grouped or aggregated.',
    examples: [
      {
        code: 'SELECT language, COUNT(*) FROM names GROUP BY language',
        note: '3 rows, one per language: 1395 English names, 629 German, 9 French.',
      },
      {
        code: 'GROUP BY s.id',
        note: 'One row per spectrum, however many peaks it carries.',
      },
    ],
  },
  having: {
    title: 'HAVING',
    summary:
      'Filters groups after they are formed, where WHERE filters rows before. A condition on COUNT belongs in HAVING; a condition on a column belongs in WHERE.',
    examples: [
      {
        code: "WHERE system = 'ghs-hazard' GROUP BY code HAVING COUNT(*) >= 20",
        note: 'WHERE drops the other five systems, HAVING drops the rare codes: 5 remain.',
      },
      {
        code: 'WHERE COUNT(*) >= 20',
        note: 'Fails — misuse of aggregate function COUNT().',
      },
    ],
  },
  aggregate: {
    title: 'Aggregate function',
    summary:
      'Reads many rows and returns one value: COUNT, SUM, MIN, MAX, AVG. Without GROUP BY it folds the whole table into a single row.',
    examples: [
      {
        code: 'SELECT ROUND(AVG(wavenumber), 1) FROM ir_peaks',
        note: '1776.7 cm-1, over all 4463 peaks.',
      },
      {
        code: "SUM(source = 'reported')",
        note: 'Counts the rows where the test is true, because true is 1.',
      },
    ],
  },
  null: {
    title: 'NULL',
    summary:
      'The absence of a value, not zero and not the empty string. It is never equal to anything, itself included, so it is tested with IS NULL.',
    examples: [
      {
        code: 'SELECT COUNT(*) FROM catalog_entries WHERE description IS NULL',
        note: '769 of the 1049 listings carry no description.',
      },
      {
        code: 'WHERE description = NULL',
        note: 'Returns nothing, ever — the comparison is neither true nor false.',
      },
    ],
  },
  'window function': {
    title: 'Window function',
    summary:
      'Computes a value across a set of rows without folding them into one, so each row keeps its identity and gains a rank, a running total or a neighbour.',
    examples: [
      {
        code: 'ROW_NUMBER() OVER (PARTITION BY reported.id ORDER BY ABS(reported.wavenumber - picked.wavenumber))',
        note: 'Numbers the candidates per band, so `nth = 1` is the nearest one.',
      },
    ],
  },
  cte: {
    title: 'CTE (common table expression)',
    summary:
      'A named result defined with WITH and used like a table in the statement that follows. It gives a step of the reasoning a name, and can be referenced twice.',
    examples: [
      {
        code: 'WITH claims AS (SELECT ...) SELECT * FROM claims hi JOIN claims lo ON ...',
        note: 'One definition, joined to itself to put two pressures on one line.',
      },
    ],
  },
  index: {
    title: 'Index',
    summary:
      'A sorted copy of one column that lets the engine find rows without reading the table. It speeds up a lookup and costs nothing to query — you never name it.',
    examples: [
      {
        code: 'CREATE INDEX idx_ir_peaks_wavenumber ON ir_peaks(wavenumber)',
        note: 'Why a filter on wavenumber does not scan all 4463 peaks.',
      },
      {
        code: '{"selector": {"mass": {"$gt": 300}}, "sort": [{"mass": "desc"}]}',
        note: 'A real CouchDB refuses this sort until an index on `mass` exists.',
      },
    ],
  },
  normalisation: {
    title: 'Normalisation',
    summary:
      'Storing each fact once, in the table it belongs to, and pointing at it from elsewhere. It is why a compound has no boiling point column: the claim belongs to a listing.',
    examples: [
      {
        code: 'compounds -> catalog_entries -> boiling_points',
        note: '1,2-Diaminocyclohexane: 188 C at 760 mmHg, 104 C at 40, 79 C at 15.',
      },
      {
        code: 'names(compound_id, value, language)',
        note: 'Twelve names for 2-Propanol, in twelve rows, not one comma-separated column.',
      },
    ],
  },
  listing: {
    title: 'Listing',
    summary:
      'One supplier’s row for one compound, stored in `catalog_entries`. Every physical property and every hazard hangs off a listing rather than off the compound, so one compound can carry several claims that disagree.',
    examples: [
      {
        code: 'SELECT COUNT(*) FROM catalog_entries',
        note: '1049 listings across the 541 compounds.',
      },
      {
        code: 'JOIN catalog_entries e ON e.compound_id = c.id JOIN melting_points m ON m.catalog_entry_id = e.id',
        note: 'The two hops that stand between a compound and a melting point.',
      },
    ],
  },
  subquery: {
    title: 'Subquery',
    summary:
      'A SELECT written inside another statement. A correlated one names a column of the outer row, so the engine answers it once per row — which is how EXISTS and NOT EXISTS test for a row that may not be there.',
    examples: [
      {
        code: 'WHERE NOT EXISTS (SELECT 1 FROM ir_spectra s WHERE s.compound_id = c.id)',
        note: 'True for a compound with no IR spectrum: 370 of the 541.',
      },
      {
        code: 'WHERE id IN (SELECT compound_id FROM ir_spectra)',
        note: 'The 171 compounds that have an IR spectrum.',
      },
    ],
  },
  'coupling constant': {
    title: 'Coupling constant',
    summary:
      'The spacing in hertz between the lines of a split NMR signal, written J. It says how strongly two nuclei sense each other, and it stays the same when the field changes, which a shift measured in hertz does not.',
    examples: [
      {
        code: 'SELECT coupling_hz FROM nmr_couplings',
        note: '197 constants across the 50 spectra.',
      },
      {
        code: "SELECT * FROM nmr_signals WHERE multiplicity = 'dd'",
        note: '26 signals, and each one carries two constants, so a join returns two rows per signal.',
      },
    ],
  },
  document: {
    title: 'Document',
    summary:
      'One JSON object holding a compound and everything under it — names, listings, spectra — already nested. Mango queries documents, and returns whole documents.',
    examples: [
      {
        code: '{"selector": {"name": "1,2-Diaminocyclohexane"}}',
        note: 'One document, carrying all five listings and the three boiling points they claim.',
      },
      {
        code: '_id: "compound:295"',
        note: 'A document’s key, which is the compound id with a prefix.',
      },
    ],
  },
  selector: {
    title: 'Selector',
    summary:
      'The condition every returned document satisfies — Mango’s WHERE. It is a JSON object: a field name, then either a value or an operator object.',
    examples: [
      {
        code: '{"selector": {"formula": "C2H6O"}}',
        note: 'Equality is written plainly, with no operator.',
      },
      {
        code: '{"selector": {"mass": {"$gt": 300}, "nbSuppliers": {"$gte": 10}}}',
        note: 'Two keys in one object are an AND: 13 documents.',
      },
    ],
  },
  projection: {
    title: 'Projection',
    summary:
      'The `fields` list, naming what to keep of each returned document — Mango’s column list. Leave it out and the whole document comes back, spectra included.',
    examples: [
      {
        code: '{"fields": ["name", "formula", "mass"]}',
        note: 'Three keys instead of the full document.',
      },
      {
        code: '{"fields": ["name", "listings"]}',
        note: 'An array comes back whole — a dotted path such as `listings.supplier` does not reach into it.',
      },
    ],
  },
  $elemmatch: {
    title: '$elemMatch',
    summary:
      'Asks whether one element of an array satisfies a condition. It is what a document store has instead of a join, and it nests as deep as the document does.',
    examples: [
      {
        code: '{"selector": {"names": {"$elemMatch": {"language": "fr"}}}}',
        note: '7 compounds carry a French name.',
      },
      {
        code: '{"selector": {"listings": {"$elemMatch": {"boilingPoints": {"$elemMatch": {"pressure": {"$lt": 50}}}}}}}',
        note: '106 compounds boil under vacuum somewhere in their listings.',
      },
      {
        code: '{"selector": {"names.language": "fr"}}',
        note: 'Returns nothing — a dotted path does not step into an array.',
      },
    ],
  },
  $allmatch: {
    title: '$allMatch',
    summary:
      'Asks whether every element of an array satisfies a condition. Use it for "none of them is otherwise", which no single-element test can express.',
    examples: [
      {
        code: '{"selector": {"ir": {"$elemMatch": {"peaks": {"$allMatch": {"source": "picked"}}}}}}',
        note: 'One compound, Nerol: the only spectrum with no reported band list.',
      },
    ],
  },
  $size: {
    title: '$size',
    summary:
      'Matches a document whose array holds exactly that many elements. It counts the array itself, which is the one count a selector can ask for without a map-reduce view.',
    examples: [
      {
        code: '{"selector": {"cas": {"$size": 3}}}',
        note: '38 compounds are registered under exactly three CAS numbers.',
      },
      {
        code: '{"selector": {"ir": {"$size": 0}}}',
        note: 'The 370 compounds with no IR spectrum: an absent branch is an empty array, not a missing one.',
      },
    ],
  },
  'query planner': {
    title: 'Query planner',
    summary:
      'The part of the engine that decides how to run a statement — which index to use, which table to read first. You write what you want, not how to get it.',
    examples: [
      {
        code: 'EXPLAIN QUERY PLAN SELECT * FROM names WHERE compound_id = 295',
        note: 'Reports that it searches the index rather than scanning 2033 rows.',
      },
    ],
  },
};
