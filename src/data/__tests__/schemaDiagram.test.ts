import { expect, test } from 'vitest';

import type { TableInfo } from '../schema.ts';
import { SCHEMA } from '../schema.ts';
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  SCHEMA_DIAGRAM,
  layoutSchema,
} from '../schemaDiagram.ts';

const { nodes, edges, marks, width, height } = SCHEMA_DIAGRAM;
const byName = new Map(nodes.map((node) => [node.name, node]));

function describeEdge(edge: { parent: string; child: string }): string {
  return `${edge.parent}→${edge.child}`;
}

test('every table of the schema gets a box', () => {
  expect(nodes.map((node) => node.name).toSorted()).toStrictEqual(
    SCHEMA.map((table) => table.name).toSorted(),
  );
  expect(nodes).toHaveLength(16);
});

test('every foreign key of the schema gets an arrow', () => {
  const expected = SCHEMA.flatMap((table) => {
    const drawn = new Set<string>();
    return table.columns.flatMap((column) => {
      const reference = column.references;
      if (!reference || drawn.has(reference.table)) return [];
      drawn.add(reference.table);
      return [`${reference.table}→${table.name}`];
    });
  });

  expect(edges.map(describeEdge)).toStrictEqual(expected);
  expect(edges).toHaveLength(17);
});

function depthOf(name: string): number | undefined {
  return byName.get(name)?.depth;
}

test('compounds opens the diagram and a coupling constant closes it', () => {
  expect(depthOf('compounds')).toBe(0);
  expect(depthOf('structures')).toBe(1);
  expect(depthOf('catalog_entries')).toBe(1);
  expect(depthOf('nmr_spectra')).toBe(2);
  expect(depthOf('nmr_ranges')).toBe(3);
  expect(depthOf('nmr_signals')).toBe(4);
  expect(depthOf('nmr_couplings')).toBe(5);
});

test('an arrow runs right, from the table a key names to the table carrying it', () => {
  for (const edge of edges) {
    const parent = byName.get(edge.parent);
    const child = byName.get(edge.child);

    expect(parent?.x).toBeLessThan(Number(child?.x));
    expect(edge.path.startsWith(`M ${Number(parent?.x) + NODE_WIDTH} `)).toBe(
      true,
    );
    expect(edge.path.endsWith(`H ${child?.x}`)).toBe(true);
  }
});

test('a chain of single children is one straight line', () => {
  const chain = ['nmr_spectra', 'nmr_ranges', 'nmr_signals', 'nmr_couplings'];

  expect(chain.map((name) => byName.get(name)?.y)).toStrictEqual(
    chain.map(() => byName.get('nmr_spectra')?.y),
  );
  expect(byName.get('ir_peaks')?.y).toBe(byName.get('ir_spectra')?.y);
  expect(
    edges.filter((edge) => !edge.path.includes('V')).map(describeEdge),
  ).toStrictEqual([
    'compounds→cas_numbers',
    'catalog_entries→flash_points',
    'ir_spectra→ir_peaks',
    'nmr_spectra→nmr_ranges',
    'nmr_ranges→nmr_signals',
    'nmr_signals→nmr_couplings',
  ]);
});

test('a spectrum hangs off its listing, and its compound key is a second arrow', () => {
  expect(
    edges.filter((edge) => edge.secondary).map(describeEdge),
  ).toStrictEqual(['compounds→ir_spectra', 'compounds→nmr_spectra']);
});

test('a key is one to many unless no two rows share it', () => {
  expect(
    edges
      .filter((edge) => edge.cardinality === '1:1')
      .map((edge) => edge.child),
  ).toStrictEqual(['structures']);
  expect(marks.filter((mark) => mark.text === 'n')).toHaveLength(16);
  expect(marks.filter((mark) => mark.anchor === 'start')).toHaveLength(6);
});

test('no two boxes overlap, and every box fits the canvas', () => {
  const seen = new Set<string>();
  for (const node of nodes) {
    expect(seen.has(`${node.x},${node.y}`)).toBe(false);

    seen.add(`${node.x},${node.y}`);

    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.x + NODE_WIDTH).toBeLessThanOrEqual(width);
    expect(node.y + NODE_HEIGHT).toBeLessThanOrEqual(height);
  }
});

const PARENT: TableInfo = {
  name: 'parent',
  kind: 'table',
  group: 'compound',
  blurb: 'A table nothing points out of.',
  rowCount: 2,
  columns: [
    { name: 'id', type: 'INTEGER', nullable: false, description: 'the key' },
  ],
};

test('a table with no key either way stands alone in the first column', () => {
  const { nodes: alone } = layoutSchema([PARENT]);

  expect(alone).toStrictEqual([
    {
      name: 'parent',
      kind: 'table',
      blurb: 'A table nothing points out of.',
      rowCount: 2,
      columns: PARENT.columns,
      depth: 0,
      x: 8,
      y: 8,
    },
  ]);
});

test('a view is drawn dashed, because it reads a column rather than declaring a key', () => {
  const view: TableInfo = {
    name: 'summary',
    kind: 'view',
    group: 'compound',
    blurb: 'One row per parent, computed.',
    rowCount: 2,
    columns: [
      {
        name: 'parent_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the parent read',
        references: { table: 'parent', column: 'id' },
        unique: true,
      },
    ],
  };
  const { edges: drawn, marks: written } = layoutSchema([PARENT, view]);

  expect(
    drawn.map((edge) => [describeEdge(edge), edge.dashed, edge.cardinality]),
  ).toStrictEqual([['parent→summary', true, '1:1']]);
  expect(written.map((mark) => mark.text)).toStrictEqual(['1', '1']);
});
