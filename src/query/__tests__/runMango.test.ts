import { expect, test } from 'vitest';

import { MangoError, runMango } from '../runMango.ts';

const DOCS = [
  {
    _id: 'a',
    name: 'Ethanol',
    mass: 46,
    charge: 0,
    elements: { C: 2, H: 6, O: 1 },
    names: [
      { value: 'Ethanol', language: 'en' },
      { value: 'Ethanol', language: 'de' },
    ],
    listings: [
      { supplier: 'Acros', boilingPoints: [{ low: 78, pressure: 760 }] },
    ],
  },
  {
    _id: 'b',
    name: 'Water',
    mass: 18,
    charge: 0,
    elements: { H: 2, O: 1 },
    names: [{ value: 'Water', language: 'en' }],
    listings: [
      { supplier: 'Acros', boilingPoints: [{ low: 100, pressure: 760 }] },
    ],
  },
  {
    _id: 'c',
    name: 'Benzene',
    mass: 78,
    charge: 0,
    elements: { C: 6, H: 6 },
    names: [
      { value: 'Benzene', language: 'en' },
      { value: 'Benzol', language: 'de' },
    ],
    listings: [
      {
        supplier: 'Fluka',
        boilingPoints: [
          { low: 80, pressure: 760 },
          { low: 26, pressure: 100 },
        ],
      },
    ],
  },
  {
    _id: 'd',
    name: 'Ammonium',
    mass: 18,
    charge: 1,
    elements: { N: 1, H: 4 },
    names: [],
    listings: [],
  },
];

test('an equality selector matches exactly', () => {
  const result = runMango(DOCS, { selector: { name: 'Water' } });
  expect(result.docs).toHaveLength(1);
  expect(result.docs[0]?._id).toBe('b');
  expect(result.matched).toBe(1);
});

test('comparison operators work on numbers', () => {
  expect(runMango(DOCS, { selector: { mass: { $gt: 40 } } }).matched).toBe(2);
  expect(runMango(DOCS, { selector: { mass: { $lte: 18 } } }).matched).toBe(2);
  expect(
    runMango(DOCS, { selector: { charge: { $ne: 0 } } }).docs[0]?._id,
  ).toBe('d');
});

test('without a sort, documents come back in _id order, as CouchDB returns them', () => {
  const shuffled = [DOCS[2], DOCS[0], DOCS[3], DOCS[1]] as typeof DOCS;
  const result = runMango(shuffled, { selector: {}, fields: ['_id'] });
  expect(result.docs).toStrictEqual([
    { _id: 'a' },
    { _id: 'b' },
    { _id: 'c' },
    { _id: 'd' },
  ]);
});

test('a dotted path reaches into an object', () => {
  const result = runMango(DOCS, { selector: { 'elements.C': { $gte: 6 } } });
  expect(result.docs.map((doc) => doc._id)).toStrictEqual(['c']);
});

test('$elemMatch reaches into an array of objects', () => {
  const result = runMango(DOCS, {
    selector: { names: { $elemMatch: { language: 'de' } } },
  });
  expect(result.docs.map((doc) => doc._id)).toStrictEqual(['a', 'c']);
});

test('$elemMatch nests', () => {
  const result = runMango(DOCS, {
    selector: {
      listings: {
        $elemMatch: {
          boilingPoints: { $elemMatch: { pressure: { $lt: 500 } } },
        },
      },
    },
  });
  expect(result.docs.map((doc) => doc._id)).toStrictEqual(['c']);
});

test('$and, $or and $exists combine', () => {
  expect(
    runMango(DOCS, {
      selector: { $or: [{ name: 'Water' }, { name: 'Benzene' }] },
    }).matched,
  ).toBe(2);
  expect(
    runMango(DOCS, {
      selector: { $and: [{ charge: 0 }, { mass: { $lt: 50 } }] },
    }).matched,
  ).toBe(2);
  expect(
    runMango(DOCS, { selector: { 'elements.N': { $exists: true } } }).docs[0]
      ?._id,
  ).toBe('d');
});

test('$in and $nin take a list', () => {
  expect(
    runMango(DOCS, { selector: { name: { $in: ['Water', 'Benzene'] } } })
      .matched,
  ).toBe(2);
  expect(
    runMango(DOCS, { selector: { name: { $nin: ['Water', 'Benzene'] } } })
      .matched,
  ).toBe(2);
});

test('fields projects, dotted paths included', () => {
  const result = runMango(DOCS, {
    selector: { name: 'Ethanol' },
    fields: ['name', 'elements.C'],
  });
  expect(result.docs[0]).toStrictEqual({ name: 'Ethanol', elements: { C: 2 } });
});

test('sort orders ascending and descending', () => {
  expect(
    runMango(DOCS, {
      selector: {},
      sort: [{ mass: 'asc' }],
      fields: ['name'],
    }).docs.map((d) => d.name),
  ).toStrictEqual(['Water', 'Ammonium', 'Ethanol', 'Benzene']);
  expect(
    runMango(DOCS, {
      selector: {},
      sort: [{ mass: 'desc' }],
      fields: ['name'],
    }).docs.map((d) => d.name),
  ).toStrictEqual(['Benzene', 'Ethanol', 'Ammonium', 'Water']);
});

test('a bare string sort names a field, and is not read as a character index', () => {
  const result = runMango(DOCS, {
    selector: {},
    sort: ['mass'],
    fields: ['name'],
  });
  expect(result.docs.map((doc) => doc.name)).toStrictEqual([
    'Water',
    'Ammonium',
    'Ethanol',
    'Benzene',
  ]);
});

test('limit and skip cut a window out of the result', () => {
  const result = runMango(DOCS, {
    selector: {},
    sort: [{ mass: 'asc' }],
    skip: 1,
    limit: 2,
    fields: ['name'],
  });
  expect(result.docs.map((doc) => doc.name)).toStrictEqual([
    'Ammonium',
    'Ethanol',
  ]);
  expect(result.matched).toBe(4);
  expect(result.truncated).toBe(true);
});

test('an explicit undefined limit does not empty the result', () => {
  const result = runMango(DOCS, {
    selector: {},
    limit: undefined,
    skip: undefined,
  });
  expect(result.docs).toHaveLength(4);
});

test('the returned documents are copies, so editing one leaves the source alone', () => {
  const result = runMango(DOCS, { selector: { name: 'Water' } });
  (result.docs[0] as { name: string }).name = 'changed';
  expect(DOCS[1]?.name).toBe('Water');
});

test('an unsupported operator is refused by name', () => {
  expect(() =>
    runMango(DOCS, { selector: { elements: { $keyMapMatch: { $eq: 'C' } } } }),
  ).toThrow(MangoError);
  expect(() =>
    runMango(DOCS, { selector: { elements: { $keyMapMatch: { $eq: 'C' } } } }),
  ).toThrow(/\$keyMapMatch/);
});

test('mixed sort directions are refused, as CouchDB refuses them', () => {
  expect(() =>
    runMango(DOCS, { selector: {}, sort: [{ mass: 'asc' }, { name: 'desc' }] }),
  ).toThrow(/same way/);
});

test('an inline regex flag is explained rather than thrown as a group error', () => {
  expect(() =>
    runMango(DOCS, { selector: { name: { $regex: '(?i)^eth' } } }),
  ).toThrow(/inline flag/);
});

test('a regex that cannot compile says so', () => {
  expect(() => runMango(DOCS, { selector: { name: { $regex: '[' } } })).toThrow(
    /could not be compiled/,
  );
});

test('a workable regex matches', () => {
  expect(
    runMango(DOCS, { selector: { name: { $regex: '^[BW]' } } }).matched,
  ).toBe(2);
});

test('a selector that is not an object is refused', () => {
  expect(() =>
    runMango(DOCS, { selector: [] as unknown as Record<string, unknown> }),
  ).toThrow(MangoError);
});

test('the document cap is honoured', () => {
  const result = runMango(DOCS, { selector: {} }, { maxDocuments: 2 });
  expect(result.docs).toHaveLength(2);
  expect(result.matched).toBe(4);
  expect(result.truncated).toBe(true);
});

const NESTED = [
  {
    name: 'a',
    listings: [
      { supplier: 'Acros', hazards: [{ code: 'H225', system: 'ghs-hazard' }] },
    ],
  },
  {
    name: 'b',
    listings: [
      { supplier: 'Fluka', hazards: [{ code: 'H319', system: 'ghs-hazard' }] },
    ],
  },
  {
    name: 'c',
    listings: [
      { supplier: 'Acros', hazards: [{ code: 'H319', system: 'ghs-hazard' }] },
    ],
  },
];

test('$and works inside $elemMatch, as it does in CouchDB', () => {
  const result = runMango(NESTED, {
    selector: {
      listings: {
        $elemMatch: {
          $and: [
            { supplier: 'Acros' },
            { hazards: { $elemMatch: { code: 'H225' } } },
          ],
        },
      },
    },
  });
  expect(result.docs.map((doc) => doc.name)).toStrictEqual(['a']);
});

test('$and nests two levels deep inside element matchers', () => {
  const result = runMango(NESTED, {
    selector: {
      listings: {
        $elemMatch: {
          hazards: {
            $elemMatch: { $and: [{ code: 'H319' }, { system: 'ghs-hazard' }] },
          },
        },
      },
    },
  });
  expect(result.docs.map((doc) => doc.name)).toStrictEqual(['b', 'c']);
});

test('$or inside $elemMatch keeps working', () => {
  const result = runMango(NESTED, {
    selector: {
      listings: {
        $elemMatch: { hazards: { $elemMatch: { $or: [{ code: 'H225' }] } } },
      },
    },
  });
  expect(result.docs.map((doc) => doc.name)).toStrictEqual(['a']);
});
