/**
 * The translation reference: one row per clause, SQL on the left and the Mango
 * selector that asks the same question on the right.
 *
 * Every `example` in this file was run against `public/chem.sqlite` with
 * `scripts/run-query.mjs`, so a row that claims a count claims a measured one.
 */

export interface CheatRow {
  /** What the row is for, in the student's words. */
  concept: string;
  /** The SQL spelling. */
  sql: string;
  /**
   * The Mango spelling, as compact JSON. Absent when Mango cannot say it.
   * @default undefined
   */
  mango?: string;
  /**
   * One sentence: what differs between the two, or why Mango cannot.
   * @default undefined
   */
  note?: string;
  /**
   * A pair that runs against this database, ready to paste.
   * @default undefined
   */
  example?: {
    /** The SQL query. */
    sql: string;
    /**
     * The Mango query, as JSON.
     * @default undefined
     */
    mango?: string;
  };
}

export interface CheatSection {
  /** The section heading. */
  title: string;
  /** One or two sentences saying what the section covers. */
  blurb: string;
  /** The rows, in reading order. */
  rows: readonly CheatRow[];
}

/** The printable SQL/Mango reference, in reading order. */
export const CHEAT_SECTIONS: readonly CheatSection[] = [
  {
    title: 'Choosing rows',
    blurb:
      'A WHERE clause and a Mango selector are the same idea in two notations. SQL writes a condition as an expression; Mango writes it as JSON, with the field as the key.',
    rows: [
      {
        concept: 'the column equals a value',
        sql: "WHERE formula = 'C2H6O'",
        mango: '{"formula": "C2H6O"}',
        note: 'Mango reads a bare value as `$eq`, so `{"formula": {"$eq": "C2H6O"}}` says the same thing.',
        example: {
          sql: "SELECT id, preferred_name, formula FROM compounds WHERE formula = 'C2H6O'",
          mango: '{"selector": {"formula": "C2H6O"}, "fields": ["_id", "name", "formula"]}',
        },
      },
      {
        concept: 'the column differs from a value',
        sql: "WHERE formula <> 'C2H6O'",
        mango: '{"formula": {"$ne": "C2H6O"}}',
        note: 'SQL throws away rows whose column is NULL, while `$ne` keeps a document whose field is missing.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE formula <> 'C2H6O'",
          mango: '{"selector": {"formula": {"$ne": "C2H6O"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'greater than, or at least',
        sql: 'WHERE molecular_weight > 300\nWHERE molecular_weight >= 300',
        mango: '{"mass": {"$gt": 300}}\n{"mass": {"$gte": 300}}',
        note: 'The column lives in `structures`, while the document keeps it on the compound as `mass`, so the operator translates but the name and the join do not.',
        example: {
          sql: 'SELECT c.preferred_name, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id WHERE s.molecular_weight > 300 ORDER BY s.molecular_weight DESC',
          mango:
            '{"selector": {"mass": {"$gt": 300}}, "fields": ["name", "mass"], "sort": [{"mass": "desc"}]}',
        },
      },
      {
        concept: 'less than, or at most',
        sql: 'WHERE unsaturation < 1\nWHERE unsaturation <= 1',
        mango: '{"unsaturation": {"$lt": 1}}\n{"unsaturation": {"$lte": 1}}',
        note: "SQL drops the compounds whose unsaturation is null while Mango keeps them, because CouchDB's collation sorts null below every number.",
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds WHERE unsaturation < 1',
          mango: '{"selector": {"unsaturation": {"$lt": 1}}, "fields": ["name", "unsaturation"]}',
        },
      },
      {
        concept: 'a two-sided range',
        sql: 'WHERE molecular_weight BETWEEN 100 AND 150',
        mango: '{"mass": {"$gte": 100, "$lte": 150}}',
        note: 'Mango has no `BETWEEN`, so write both bounds under the field — two operators on one field are already ANDed.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM structures WHERE molecular_weight BETWEEN 100 AND 150',
          mango: '{"selector": {"mass": {"$gte": 100, "$lte": 150}}, "fields": ["name", "mass"]}',
        },
      },
      {
        concept: 'one of a list',
        sql: "WHERE formula IN ('C2H6O', 'C7H8', 'C6H6O')",
        mango: '{"formula": {"$in": ["C2H6O", "C7H8", "C6H6O"]}}',
        example: {
          sql: "SELECT preferred_name, formula FROM compounds WHERE formula IN ('C2H6O', 'C7H8', 'C6H6O')",
          mango:
            '{"selector": {"formula": {"$in": ["C2H6O", "C7H8", "C6H6O"]}}, "fields": ["name", "formula"]}',
        },
      },
      {
        concept: 'none of a list',
        sql: "WHERE formula NOT IN ('C2H6O', 'C7H8', 'C6H6O')",
        mango: '{"formula": {"$nin": ["C2H6O", "C7H8", "C6H6O"]}}',
        note: 'A NULL column makes `NOT IN` drop the row, while `$nin` keeps a document that has no such field at all.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE formula NOT IN ('C2H6O', 'C7H8', 'C6H6O')",
          mango:
            '{"selector": {"formula": {"$nin": ["C2H6O", "C7H8", "C6H6O"]}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'a pattern',
        sql: "WHERE preferred_name LIKE 'Iso%'",
        mango: '{"name": {"$regex": "^Iso"}}',
        note: "SQLite's `LIKE` ignores ASCII case and `$regex` does not, so the first finds 9 compounds and the second 8.",
        example: {
          sql: "SELECT preferred_name FROM compounds WHERE preferred_name LIKE 'Iso%' ORDER BY preferred_name",
          mango: '{"selector": {"name": {"$regex": "^Iso"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'the field is null',
        sql: 'WHERE unsaturation IS NULL',
        mango: '{"unsaturation": null}',
        note: 'A stored null matches, a missing field does not — those are two different states in JSON and only one in SQL.',
        example: {
          sql: 'SELECT id, preferred_name, formula FROM compounds WHERE unsaturation IS NULL',
          mango: '{"selector": {"unsaturation": null}, "fields": ["_id", "name", "formula"]}',
        },
      },
      {
        concept: 'the field is not null',
        sql: 'WHERE unsaturation IS NOT NULL',
        mango: '{"unsaturation": {"$ne": null}}',
        note: 'Use `$ne: null` and not `$exists: true`, because a key holding null still exists.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds WHERE unsaturation IS NOT NULL',
          mango: '{"selector": {"unsaturation": {"$ne": null}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'the field is there at all',
        sql: 'no spelling — every row has every column',
        mango: '{"unsaturation": {"$exists": true}}',
        note: 'A table fixes its columns, so only a document can be missing a key — and a key holding null still exists, so this matches all 541 documents, the 7 whose unsaturation is null included.',
        example: {
          sql: 'SELECT COUNT(*) AS n, COUNT(unsaturation) AS known FROM compounds',
          mango: '{"selector": {"unsaturation": {"$exists": true}}, "fields": ["name", "unsaturation"]}',
        },
      },
      {
        concept: 'both conditions',
        sql: 'WHERE molecular_weight > 200 AND nb_suppliers > 20',
        mango: '{"mass": {"$gt": 200}, "nbSuppliers": {"$gt": 20}}',
        note: 'Two keys in one selector are already ANDed; `$and` is only needed when one field carries two whole conditions.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds c JOIN structures s ON s.compound_id = c.id WHERE s.molecular_weight > 200 AND c.nb_suppliers > 20',
          mango:
            '{"selector": {"mass": {"$gt": 200}, "nbSuppliers": {"$gt": 20}}, "fields": ["name", "mass", "nbSuppliers"]}',
        },
      },
      {
        concept: 'either condition',
        sql: "WHERE formula = 'C2H6O' OR formula = 'C7H8'",
        mango: '{"$or": [{"formula": "C2H6O"}, {"formula": "C7H8"}]}',
        note: '`$or` takes an array of whole selectors, not a list of values — for values, reach for `$in`.',
        example: {
          sql: "SELECT preferred_name, formula FROM compounds WHERE formula = 'C2H6O' OR formula = 'C7H8'",
          mango:
            '{"selector": {"$or": [{"formula": "C2H6O"}, {"formula": "C7H8"}]}, "fields": ["name", "formula"]}',
        },
      },
      {
        concept: 'the opposite of a condition',
        sql: 'WHERE NOT (molecular_weight > 300)',
        mango: '{"$not": {"mass": {"$gt": 300}}}',
        note: 'Both sides answer 528 here only because every molecular weight is known; a NULL column falls out of a SQL NOT and stays in a Mango `$not`.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM structures WHERE NOT (molecular_weight > 300)',
          mango: '{"selector": {"$not": {"mass": {"$gt": 300}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'neither condition',
        sql: 'WHERE NOT (a OR b)',
        mango:
          '{"$nor": [{"formula": {"$regex": "Cl"}}, {"formula": {"$regex": "Br"}}]}',
        note: 'SQL has no NOR keyword, so negate the OR yourself; both sides leave 484 compounds with neither chlorine nor bromine.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE NOT (formula GLOB '*Cl*' OR formula GLOB '*Br*')",
          mango:
            '{"selector": {"$nor": [{"formula": {"$regex": "Cl"}}, {"formula": {"$regex": "Br"}}]}, "fields": ["name", "formula"]}',
        },
      },
      {
        concept: 'divides exactly',
        sql: 'WHERE nb_suppliers % 2 = 0',
        mango: '{"nbSuppliers": {"$mod": [2, 0]}}',
        note: '`$mod` takes the divisor and the remainder as a pair, and both must be integers.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds WHERE nb_suppliers % 2 = 0',
          mango:
            '{"selector": {"nbSuppliers": {"$mod": [2, 0]}}, "fields": ["name", "nbSuppliers"]}',
        },
      },
      {
        concept: 'an array has exactly n entries',
        sql: 'no spelling — count the child rows in a subquery',
        mango: '{"cas": {"$size": 2}}',
        note: 'SQL has no arrays, so what `$size` reads off the document costs a GROUP BY and a HAVING.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM (SELECT compound_id FROM cas_numbers GROUP BY compound_id HAVING COUNT(*) = 2)',
          mango: '{"selector": {"cas": {"$size": 2}}, "fields": ["name", "cas"]}',
        },
      },
      {
        concept: 'an array holds all of these',
        sql: 'no spelling — one EXISTS per value',
        mango: '{"cas": {"$all": ["64175"]}}',
        note: 'CAS numbers are stored without their dashes, so 64-17-5 is written 64175.',
        example: {
          sql: "SELECT c.preferred_name, n.value FROM compounds c JOIN cas_numbers n ON n.compound_id = c.id WHERE n.value = '64175'",
          mango: '{"selector": {"cas": {"$all": ["64175"]}}, "fields": ["name", "cas"]}',
        },
      },
    ],
  },
  {
    title: 'Choosing columns',
    blurb:
      'SQL names the columns it wants between SELECT and FROM. Mango names them in `fields`, and that list only picks — it never renames and never computes.',
    rows: [
      {
        concept: 'every column',
        sql: 'SELECT * FROM compounds',
        mango: '{"selector": {"formula": "C2H6O"}}',
        note: 'Leave `fields` out and the whole document comes back, nested arrays included.',
        example: {
          sql: 'SELECT * FROM compounds LIMIT 3',
          mango: '{"selector": {"formula": "C2H6O"}}',
        },
      },
      {
        concept: 'some columns',
        sql: 'SELECT id, preferred_name, formula FROM compounds',
        mango: '{"fields": ["_id", "name", "formula"]}',
        note: 'The document calls the key `_id` and holds `compound:2`, not the integer 2.',
        example: {
          sql: 'SELECT id, preferred_name, formula FROM compounds LIMIT 5',
          mango: '{"selector": {"mass": {"$lt": 60}}, "fields": ["_id", "name", "formula"]}',
        },
      },
      {
        concept: 'a nested value',
        sql: 'no spelling — join the child table',
        mango: '{"fields": ["name", "names"]}',
        note: 'An array comes back whole, and a dotted path such as `names.value` does not reach into it.',
        example: {
          sql: "SELECT c.preferred_name, n.value, n.language FROM compounds c JOIN names n ON n.compound_id = c.id WHERE c.preferred_name = 'Ethanol'",
          mango: '{"selector": {"name": "Ethanol"}, "fields": ["name", "names"]}',
        },
      },
      {
        concept: 'rename a column',
        sql: 'SELECT molecular_weight AS mw FROM structures',
        note: 'Mango has no `AS`; the field comes back under its own name and you rename it in the client.',
        example: {
          sql: 'SELECT c.preferred_name AS name, s.molecular_weight AS mw FROM compounds c JOIN structures s ON s.compound_id = c.id LIMIT 5',
        },
      },
      {
        concept: 'compute a column',
        sql: 'SELECT molecular_weight - monoisotopic_mass AS delta FROM structures',
        note: '`fields` selects and never computes, so arithmetic belongs to the code that receives the documents.',
        example: {
          sql: 'SELECT c.preferred_name, ROUND(s.molecular_weight - s.monoisotopic_mass, 4) AS delta FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY delta DESC LIMIT 5',
        },
      },
      {
        concept: 'drop duplicates',
        sql: 'SELECT DISTINCT supplier FROM catalog_entries',
        note: 'Mango returns whole documents and has no `$distinct`, so collect the values and deduplicate them yourself.',
        example: {
          sql: 'SELECT DISTINCT supplier FROM catalog_entries ORDER BY supplier',
        },
      },
    ],
  },
  {
    title: 'Ordering, limiting, paging',
    blurb:
      'Both languages sort, cut and skip. Mango is stricter: every field in one `sort` runs the same way, and a real CouchDB needs an index before it will sort at all.',
    rows: [
      {
        concept: 'sort ascending',
        sql: 'ORDER BY molecular_weight',
        mango: '{"sort": [{"mass": "asc"}]}',
        note: 'A bare `["mass"]` is legal Mango and means ascending.',
        example: {
          sql: 'SELECT c.preferred_name, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY s.molecular_weight LIMIT 5',
          mango:
            '{"selector": {"mass": {"$gt": 0}}, "sort": [{"mass": "asc"}], "fields": ["name", "mass"], "limit": 5}',
        },
      },
      {
        concept: 'sort descending',
        sql: 'ORDER BY molecular_weight DESC',
        mango: '{"sort": [{"mass": "desc"}]}',
        example: {
          sql: 'SELECT c.preferred_name, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY s.molecular_weight DESC LIMIT 5',
          mango:
            '{"selector": {"mass": {"$gt": 0}}, "sort": [{"mass": "desc"}], "fields": ["name", "mass"], "limit": 5}',
        },
      },
      {
        concept: 'sort on two fields',
        sql: 'ORDER BY nb_suppliers DESC, molecular_weight DESC',
        mango: '{"sort": [{"nbSuppliers": "desc"}, {"mass": "desc"}]}',
        note: 'The second field breaks ties in the first, in both languages.',
        example: {
          sql: 'SELECT c.preferred_name, c.nb_suppliers, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY c.nb_suppliers DESC, s.molecular_weight DESC LIMIT 5',
          mango:
            '{"selector": {"nbSuppliers": {"$gt": 0}, "mass": {"$gt": 0}}, "sort": [{"nbSuppliers": "desc"}, {"mass": "desc"}], "fields": ["name", "nbSuppliers", "mass"], "limit": 5}',
        },
      },
      {
        concept: 'sort two fields in opposite directions',
        sql: 'ORDER BY nb_suppliers DESC, preferred_name ASC',
        note: 'CouchDB refuses a `sort` that mixes "asc" and "desc", and this engine refuses it in the same words.',
        example: {
          sql: 'SELECT preferred_name, nb_suppliers FROM compounds ORDER BY nb_suppliers DESC, preferred_name ASC LIMIT 5',
        },
      },
      {
        concept: 'take the first n',
        sql: 'LIMIT 10',
        mango: '{"limit": 10}',
        note: 'Both default to everything, and this page caps the result whatever you ask for.',
        example: {
          sql: 'SELECT preferred_name FROM compounds ORDER BY preferred_name LIMIT 10',
          mango:
            '{"selector": {"mass": {"$gt": 0}}, "sort": [{"mass": "asc"}], "fields": ["name"], "limit": 10}',
        },
      },
      {
        concept: 'step over the first n',
        sql: 'LIMIT 10 OFFSET 20',
        mango: '{"limit": 10, "skip": 20}',
        note: 'Both walk and discard the skipped rows, so a large offset costs the work it appears to save.',
        example: {
          sql: 'SELECT c.preferred_name, s.molecular_weight FROM compounds c JOIN structures s ON s.compound_id = c.id ORDER BY s.molecular_weight LIMIT 10 OFFSET 20',
          mango:
            '{"selector": {"mass": {"$gt": 0}}, "sort": [{"mass": "asc"}], "fields": ["name", "mass"], "limit": 10, "skip": 20}',
        },
      },
      {
        concept: 'where the nulls land',
        sql: 'ORDER BY unsaturation NULLS LAST',
        note: 'SQLite lets you place them and CouchDB does not: its collation always sorts null before every number.',
        example: {
          sql: 'SELECT preferred_name, unsaturation FROM compounds ORDER BY unsaturation DESC NULLS LAST LIMIT 5',
          mango:
            '{"selector": {"unsaturation": {"$exists": true}}, "sort": [{"unsaturation": "asc"}], "fields": ["name", "unsaturation"], "limit": 5}',
        },
      },
    ],
  },
  {
    title: 'Counting and grouping',
    blurb:
      'This is the honest section. Mango has no aggregates at all — no COUNT, no SUM, no GROUP BY — so every number below is computed in SQL, or fetched as documents and reduced in the client.',
    rows: [
      {
        concept: 'how many rows',
        sql: 'SELECT COUNT(*) FROM compounds',
        note: 'Mango answers with documents, never a number; the closest thing is how many matched, and it counts documents rather than rows.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds',
          mango: '{"selector": {"mass": {"$gt": 0}}, "fields": ["_id"]}',
        },
      },
      {
        concept: 'how many different values',
        sql: 'SELECT COUNT(DISTINCT supplier) FROM catalog_entries',
        note: 'Ask for the documents, pull the values out and put them in a Set.',
        example: {
          sql: 'SELECT COUNT(DISTINCT supplier) AS n FROM catalog_entries',
        },
      },
      {
        concept: 'a total',
        sql: 'SELECT SUM(nb_suppliers) FROM compounds',
        note: 'Add the field up as you walk the documents.',
        example: {
          sql: 'SELECT SUM(nb_suppliers) AS total FROM compounds',
        },
      },
      {
        concept: 'an average',
        sql: 'SELECT AVG(molecular_weight) FROM structures',
        note: 'AVG skips NULLs, so divide by the count of the rows that had a value, not by the count of all of them.',
        example: {
          sql: 'SELECT ROUND(AVG(molecular_weight), 2) AS mean, COUNT(molecular_weight) AS counted FROM structures',
        },
      },
      {
        concept: 'the smallest or the largest',
        sql: 'SELECT MIN(molecular_weight), MAX(molecular_weight) FROM structures',
        mango: '{"sort": [{"mass": "desc"}], "limit": 1}',
        note: 'This is the one aggregate Mango can imitate, by sorting and taking one document.',
        example: {
          sql: 'SELECT MIN(molecular_weight) AS lightest, MAX(molecular_weight) AS heaviest FROM structures',
          mango:
            '{"selector": {"mass": {"$gt": 0}}, "sort": [{"mass": "desc"}], "fields": ["name", "mass"], "limit": 1}',
        },
      },
      {
        concept: 'one row per group',
        sql: 'SELECT system, COUNT(*) FROM hazard_statements GROUP BY system',
        note: 'Mango has no GROUP BY, so fetch the documents and build the buckets in the client.',
        example: {
          sql: 'SELECT system, COUNT(*) AS n FROM hazard_statements GROUP BY system ORDER BY n DESC',
        },
      },
      {
        concept: 'keep only some groups',
        sql: 'GROUP BY compound_id HAVING COUNT(*) > 10',
        note: 'HAVING filters after grouping, where WHERE filters before — and Mango has neither.',
        example: {
          sql: 'SELECT c.preferred_name, COUNT(*) AS nb_names FROM compounds c JOIN names n ON n.compound_id = c.id GROUP BY c.id HAVING COUNT(*) > 10 ORDER BY nb_names DESC',
        },
      },
      {
        concept: 'collapse a group into one string',
        sql: "SELECT GROUP_CONCAT(value, ', ') FROM names WHERE compound_id = 2",
        note: 'A document already holds the array, so nothing has to be collapsed to see it.',
        example: {
          sql: "SELECT c.preferred_name, GROUP_CONCAT(n.value, ' | ') AS all_names FROM compounds c JOIN names n ON n.compound_id = c.id WHERE c.preferred_name = '2-Propanol' GROUP BY c.id",
          mango: '{"selector": {"name": "2-Propanol"}, "fields": ["name", "names"]}',
        },
      },
    ],
  },
  {
    title: 'Relating tables',
    blurb:
      'A join stitches rows together when you read; a document had them stitched when it was written. The same question therefore costs a JOIN in SQL and an `$elemMatch` in Mango — and the two answers count different things.',
    rows: [
      {
        concept: 'follow a foreign key',
        sql: 'FROM compounds c JOIN names n ON n.compound_id = c.id',
        mango: '{"names": {"$elemMatch": {"language": "fr"}}}',
        note: 'The join returns one row per name and the selector returns one document per compound, which is why the two results are not the same length.',
        example: {
          sql: "SELECT c.preferred_name, n.value FROM compounds c JOIN names n ON n.compound_id = c.id WHERE n.language = 'fr'",
          mango: '{"selector": {"names": {"$elemMatch": {"language": "fr"}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'keep rows with no match',
        sql: 'LEFT JOIN ir_spectra s ON s.compound_id = c.id',
        note: 'What a LEFT JOIN shows as NULL columns, the document shows as an empty array.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds c LEFT JOIN ir_spectra s ON s.compound_id = c.id WHERE s.id IS NULL',
          mango: '{"selector": {"ir": {"$size": 0}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'a three-table chain',
        sql: 'compounds → catalog_entries → boiling_points',
        mango: '{"listings": {"$elemMatch": {"boilingPoints": {"$elemMatch": {"pressure": {"$lt": 760}}}}}}',
        note: 'Each JOIN is one more `$elemMatch`, nested where the array is nested.',
        example: {
          sql: 'SELECT COUNT(DISTINCT c.id) AS n FROM compounds c JOIN catalog_entries e ON e.compound_id = c.id JOIN boiling_points b ON b.catalog_entry_id = e.id WHERE b.pressure_mmhg < 760',
          mango:
            '{"selector": {"listings": {"$elemMatch": {"boilingPoints": {"$elemMatch": {"pressure": {"$lt": 760}}}}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'two conditions on the same child',
        sql: 'WHERE h.system = ... AND h.code = ... (one row, both tested)',
        mango: '{"listings": {"$elemMatch": {"hazards": {"$elemMatch": {"system": "ghs-hazard", "code": "H225"}}}}}',
        note: '`$elemMatch` binds both conditions to one array entry, which is exactly what a WHERE on one joined row does.',
        example: {
          sql: "SELECT COUNT(DISTINCT c.id) AS n FROM compounds c JOIN catalog_entries e ON e.compound_id = c.id JOIN hazard_statements h ON h.catalog_entry_id = e.id WHERE h.system = 'ghs-hazard' AND h.code = 'H225'",
          mango:
            '{"selector": {"listings": {"$elemMatch": {"hazards": {"$elemMatch": {"system": "ghs-hazard", "code": "H225"}}}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'two conditions on two different children',
        sql: 'two EXISTS subqueries',
        mango:
          '{"names": {"$elemMatch": {"language": "fr"}}, "ir": {"$elemMatch": {"sourceId": {"$exists": true}}}}',
        note: 'Two arrays are two keys and are ANDed, but two conditions on the same array cannot be — JSON allows one key per name, so bind them with one `$elemMatch` or finish the filtering in the client.',
        example: {
          sql: "SELECT c.preferred_name FROM compounds c WHERE EXISTS (SELECT 1 FROM names n WHERE n.compound_id = c.id AND n.language = 'fr') AND EXISTS (SELECT 1 FROM ir_spectra s WHERE s.compound_id = c.id)",
          mango:
            '{"selector": {"names": {"$elemMatch": {"language": "fr"}}, "ir": {"$elemMatch": {"sourceId": {"$exists": true}}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'does a child exist',
        sql: 'WHERE EXISTS (SELECT 1 FROM ir_spectra s WHERE s.compound_id = c.id)',
        mango: '{"ir": {"$elemMatch": {"sourceId": {"$exists": true}}}}',
        note: 'A dotted path such as `ir.sourceId` does not reach through an array, so the array needs `$elemMatch`.',
        example: {
          sql: 'SELECT COUNT(*) AS n FROM compounds c WHERE EXISTS (SELECT 1 FROM ir_spectra s WHERE s.compound_id = c.id)',
          mango:
            '{"selector": {"ir": {"$elemMatch": {"sourceId": {"$exists": true}}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'where the work happens',
        sql: 'the JOIN runs on every read, against whatever tables the question needs',
        note: 'SQL pays at read time and answers a question nobody planned for, while the document paid at write time and answers the planned one without a join.',
      },
    ],
  },
  {
    title: 'Text',
    blurb:
      "SQL matches text with LIKE and GLOB and transforms it with functions. Mango matches with `$regex` and transforms nothing — and the browser's regular expressions are not CouchDB's.",
    rows: [
      {
        concept: 'any run of characters',
        sql: "WHERE preferred_name LIKE '%ethyl%'",
        mango: '{"name": {"$regex": "ethyl"}}',
        note: 'An unanchored `$regex` matches anywhere, as `%…%` does, but it also keeps its case, so it finds 103 compounds where LIKE finds 112.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE preferred_name LIKE '%ethyl%'",
          mango: '{"selector": {"name": {"$regex": "ethyl"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'exactly one character',
        sql: "WHERE preferred_name LIKE '_ethyl%'",
        mango: '{"name": {"$regex": "^.ethyl"}}',
        note: "LIKE's `_` is the regex `.`, and LIKE's `%` is `.*`.",
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE preferred_name LIKE '_ethyl%'",
          mango: '{"selector": {"name": {"$regex": "^.ethyl"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'starts with, ends with',
        sql: "WHERE preferred_name LIKE 'Iso%'\nWHERE preferred_name LIKE '%ol'",
        mango: '{"name": {"$regex": "^Iso"}}\n{"name": {"$regex": "ol$"}}',
        note: 'A regex matches anywhere unless you anchor it, so the `^` and the `$` are doing the work `%` did.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE preferred_name LIKE '%ol'",
          mango: '{"selector": {"name": {"$regex": "ol$"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'ignore case',
        sql: "WHERE preferred_name LIKE 'iso%'",
        note: "SQLite's LIKE already ignores ASCII case, while `$regex` never does and the browser rejects the inline `(?i)` flag CouchDB accepts — spell both cases, as in `[Ii]so`.",
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE preferred_name LIKE 'iso%'",
          mango: '{"selector": {"name": {"$regex": "^[Ii]so"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'match case exactly',
        sql: "WHERE preferred_name GLOB 'Iso*'",
        mango: '{"name": {"$regex": "^Iso"}}',
        note: 'GLOB is the case-sensitive one and uses `*` and `?` where LIKE uses `%` and `_`.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE preferred_name GLOB 'Iso*'",
          mango: '{"selector": {"name": {"$regex": "^Iso"}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'a character class',
        sql: "WHERE formula GLOB 'C[0-9]H*'",
        mango: '{"formula": {"$regex": "^C[0-9]H"}}',
        note: 'GLOB borrows the same bracket syntax a regex uses, so this one line translates unchanged.',
        example: {
          sql: "SELECT COUNT(*) AS n FROM compounds WHERE formula GLOB 'C[0-9]H*'",
          mango: '{"selector": {"formula": {"$regex": "^C[0-9]H"}}, "fields": ["name", "formula"]}',
        },
      },
      {
        concept: 'a literal that a pattern would eat',
        sql: 'WHERE code LIKE \'P305 + P351%\'',
        mango: String.raw`{"code": {"$regex": "^P305 \\+ P351"}}`,
        note: 'Escape `+`, `.`, `(` and `[` in a regex, and escape `%` and `_` in a LIKE with an ESCAPE clause.',
        example: {
          sql: 'SELECT DISTINCT code, description FROM hazard_statements WHERE code LIKE \'P305 + P351%\'',
          mango: String.raw`{"selector": {"listings": {"$elemMatch": {"hazards": {"$elemMatch": {"code": {"$regex": "^P305 \\+ P351"}}}}}}, "fields": ["name"], "limit": 5}`,
        },
      },
      {
        concept: 'change the case, or glue two values',
        sql: "SELECT upper(preferred_name) || ' — ' || formula",
        note: 'Mango compares a value as it is stored and never transforms it first, so build the string in the client.',
        example: {
          sql: "SELECT upper(preferred_name) || ' — ' || formula AS label FROM compounds ORDER BY preferred_name LIMIT 5",
        },
      },
    ],
  },
  {
    title: 'This database in particular',
    blurb:
      'The joins a question about this data keeps needing, and their document counterparts. Paste one and change the name in the WHERE clause.',
    rows: [
      {
        concept: 'a compound and all its names',
        sql: 'compounds → names',
        mango: '{"selector": {"name": "2-Propanol"}, "fields": ["name", "names"]}',
        note: '2-Propanol carries 12 names across English, German and French.',
        example: {
          sql: "SELECT c.preferred_name, n.language, n.value FROM compounds c JOIN names n ON n.compound_id = c.id WHERE c.preferred_name = '2-Propanol' ORDER BY n.language, n.value",
          mango: '{"selector": {"name": "2-Propanol"}, "fields": ["name", "names"]}',
        },
      },
      {
        concept: 'every boiling point a supplier claims',
        sql: 'compounds → catalog_entries → boiling_points',
        mango:
          '{"selector": {"name": "1,2-Diaminocyclohexane"}, "fields": ["name", "listings"]}',
        note: 'A boiling point belongs to a listing and not to a compound, which is why this one has three of them at three pressures.',
        example: {
          sql: "SELECT c.preferred_name, e.supplier, b.low_c, b.high_c, b.pressure_mmhg FROM compounds c JOIN catalog_entries e ON e.compound_id = c.id JOIN boiling_points b ON b.catalog_entry_id = e.id WHERE c.preferred_name = '1,2-Diaminocyclohexane' ORDER BY b.pressure_mmhg DESC",
          mango:
            '{"selector": {"name": "1,2-Diaminocyclohexane"}, "fields": ["name", "listings"]}',
        },
      },
      {
        concept: 'the bands of an IR spectrum',
        sql: 'compounds → ir_spectra → ir_peaks',
        mango: '{"selector": {"name": "2-Propanol"}, "fields": ["name", "ir"]}',
        note: 'Filter on `ir_peaks.source` to separate the supplier\'s reported bands from the ones picked at build time.',
        example: {
          sql: "SELECT p.wavenumber, p.transmittance, p.source FROM compounds c JOIN ir_spectra s ON s.compound_id = c.id JOIN ir_peaks p ON p.ir_spectrum_id = s.id WHERE c.preferred_name = '2-Propanol' AND p.source = 'reported' ORDER BY p.wavenumber DESC",
          mango:
            '{"selector": {"ir": {"$elemMatch": {"peaks": {"$elemMatch": {"source": "picked"}}}}}, "fields": ["name"], "limit": 5}',
        },
      },
      {
        concept: 'a proton spectrum down to its couplings',
        sql: 'compounds → nmr_spectra → nmr_ranges → nmr_signals → nmr_couplings',
        mango: '{"selector": {"name": "7-Bromo-1H-indole"}, "fields": ["name", "nmr"]}',
        note: 'The 6.62–6.68 ppm range of 7-bromo-1H-indole holds one dd at 6.649 with J = 3.16 and 2.21 Hz.',
        example: {
          sql: "SELECT r.from_ppm, r.to_ppm, g.delta_ppm, g.multiplicity, j.coupling_hz FROM compounds c JOIN nmr_spectra s ON s.compound_id = c.id JOIN nmr_ranges r ON r.nmr_spectrum_id = s.id JOIN nmr_signals g ON g.nmr_range_id = r.id JOIN nmr_couplings j ON j.nmr_signal_id = g.id WHERE c.preferred_name = '7-Bromo-1H-indole' ORDER BY g.delta_ppm",
          mango: '{"selector": {"name": "7-Bromo-1H-indole"}, "fields": ["name", "nmr"]}',
        },
      },
      {
        concept: 'the hazards a listing declares',
        sql: 'compounds → catalog_entries → hazard_statements',
        mango: '{"listings": {"$elemMatch": {"hazards": {"$elemMatch": {"code": "H225"}}}}}',
        note: 'The `system` column separates six vocabularies, so filter on it before you compare codes.',
        example: {
          sql: "SELECT DISTINCT c.preferred_name FROM compounds c JOIN catalog_entries e ON e.compound_id = c.id JOIN hazard_statements h ON h.catalog_entry_id = e.id WHERE h.system = 'ghs-hazard' AND h.code = 'H225' ORDER BY c.preferred_name",
          mango:
            '{"selector": {"listings": {"$elemMatch": {"hazards": {"$elemMatch": {"code": "H225"}}}}}, "fields": ["name"]}',
        },
      },
      {
        concept: 'several counts on one line',
        sql: 'one scalar subquery per count',
        note: 'Joining names and listings in one FROM multiplies them — Glucan’s 49 names and 26 listings come back as 1274 rows — so each count gets a subquery of its own.',
        example: {
          sql: 'SELECT c.preferred_name, (SELECT COUNT(*) FROM names n WHERE n.compound_id = c.id) AS nb_names, (SELECT COUNT(*) FROM catalog_entries e WHERE e.compound_id = c.id) AS nb_listings, (SELECT COUNT(*) FROM ir_spectra s WHERE s.compound_id = c.id) AS nb_ir_spectra, (SELECT COUNT(*) FROM nmr_spectra s WHERE s.compound_id = c.id) AS nb_nmr_spectra FROM compounds c ORDER BY nb_names DESC LIMIT 10',
        },
      },
    ],
  },
];
