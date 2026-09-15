import memoryAdapter from 'pouchdb-adapter-memory';
import PouchDB from 'pouchdb-core';
import findPlugin from 'pouchdb-find';
import { afterAll, beforeAll, expect, test } from 'vitest';

import type { ShippedDatabase } from '../../data/__tests__/openShippedDatabase.ts';
import { openShippedDatabase } from '../../data/__tests__/openShippedDatabase.ts';
import { CHEAT_SECTIONS } from '../../data/cheatsheet.ts';
import { EXERCISES } from '../../data/exercises.ts';
import { TUTORIAL_STEPS } from '../../data/tutorialSteps.ts';
import type { MangoQuery } from '../runMango.ts';
import { runMango } from '../runMango.ts';

// The site runs Mango in the page with CouchDB's selector engine. PouchDB is the
// whole database — query planner, indexes, `_id` order — so every query the
// site teaches is run through both, and a query that would fail or answer
// differently against a real deployment fails here first.
PouchDB.plugin(memoryAdapter).plugin(findPlugin);

const MAX_DOCUMENTS = 1000;

let shipped: ShippedDatabase;
// Without a sort, CouchDB answers in the order of whichever index it picks, so
// an index built for one sorted query reorders every later unsorted one. The
// unsorted queries therefore run on a database that never gets an index, where
// the order is `_id` order, and the sorted ones on a database of their own.
let plain: PouchDB.Database;
let indexed: PouchDB.Database;

beforeAll(async () => {
  shipped = await openShippedDatabase();
  plain = new PouchDB('chem-plain', { adapter: 'memory' });
  indexed = new PouchDB('chem-indexed', { adapter: 'memory' });
  await plain.bulkDocs(structuredClone(shipped.documents));
  await indexed.bulkDocs(structuredClone(shipped.documents));
}, 60_000);

afterAll(async () => {
  await plain.destroy();
  await indexed.destroy();
});

const QUERIES = [
  ...TUTORIAL_STEPS.flatMap((step) =>
    step.mango ? [[`tutorial ${step.id}`, step.mango] as const] : [],
  ),
  ...EXERCISES.flatMap((exercise) =>
    exercise.mangoSolution
      ? [[`exercise ${exercise.id}`, exercise.mangoSolution] as const]
      : [],
  ),
  ...CHEAT_SECTIONS.flatMap((section) =>
    section.rows.flatMap((row) =>
      row.example?.mango
        ? [
            [
              `cheatsheet ${section.title} — ${row.concept}`,
              row.example.mango,
            ] as const,
          ]
        : [],
    ),
  ),
];

test('there are Mango queries to check', () => {
  expect(QUERIES.length).toBeGreaterThan(40);
});

test.each(QUERIES)('%s answers as PouchDB answers', async (_label, text) => {
  const query = JSON.parse(text) as MangoQuery;
  const sortFields = (query.sort ?? []).map((entry) =>
    typeof entry === 'string' ? entry : (Object.keys(entry)[0] as string),
  );
  const couch = sortFields.length > 0 ? indexed : plain;
  if (sortFields.length > 0) {
    // CouchDB only sorts along an index, so the one a deployment needs is built.
    await couch.createIndex({ index: { fields: sortFields } });
  }

  const expected = await couch.find({
    limit: MAX_DOCUMENTS,
    ...query,
  } as PouchDB.Find.FindRequest<object>);
  const actual = runMango(shipped.documents, query, {
    maxDocuments: MAX_DOCUMENTS,
  });

  expect(actual.docs).toStrictEqual(expected.docs.map(withoutRevision));
});

function withoutRevision(doc: object): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...doc };
  delete copy._rev;
  return copy;
}
