/**
 * Where every table sits in the diagram on the schema page.
 *
 * Nothing here is drawn by hand. The boxes are `SCHEMA` itself, and the arrows
 * are the `references` its columns already carry, so a table added to
 * `schema.ts` gets a box and a key added to a column gets an arrow. A column of
 * the diagram is a depth in the foreign-key graph, and the boxes form a tree:
 * each table hangs off the deepest table it points at, and a parent sits level
 * with one of its children so a chain of keys reads as one straight line.
 */

import type { ColumnInfo, TableInfo } from './schema.ts';
import { SCHEMA } from './schema.ts';
import { layoutRows } from './schemaTree.ts';

/** One box of the diagram: a table or a view, placed on the canvas. */
export interface DiagramNode {
  /** The table name, which is also the anchor of its card lower on the page. */
  name: string;
  /** Whether the rows are stored or computed. */
  kind: 'table' | 'view';
  /** What one row is, read on hover. */
  blurb: string;
  /** The number of rows, written under the name. */
  rowCount: number;
  /** The columns and their types, listed on hover. */
  columns: readonly ColumnInfo[];
  /** How many joins away from a table nothing points out of. */
  depth: number;
  /** The left edge, in canvas units. */
  x: number;
  /** The top edge, in canvas units. */
  y: number;
}

/** One arrow, from the table a key names to the table carrying that key. */
export interface DiagramEdge {
  /** The table the key names: the "1" side. */
  parent: string;
  /** The table carrying the key: the "n" side, or "1" when the key is unique. */
  child: string;
  /** `compounds.id → names.compound_id`, read on hover. */
  label: string;
  /** How many child rows one parent row can have. */
  cardinality: '1:1' | '1:n';
  /** Whether a view reads the column rather than a table declaring a key. */
  dashed: boolean;
  /** Whether the child already hangs off another parent in the tree. */
  secondary: boolean;
  /** The line, from the parent's right edge to the child's left edge. */
  path: string;
}

/** A "1" or "n" written on an arrow, next to the box it describes. */
export interface DiagramMark {
  /** The anchor, in canvas units. */
  x: number;
  /** The baseline, in canvas units. */
  y: number;
  /** The cardinality on that end of the arrow. */
  text: '1' | 'n';
  /** Which side of the anchor the text grows from. */
  anchor: 'start' | 'end';
}

/** The whole drawing: the canvas it needs, its boxes, arrows and marks. */
export interface SchemaDiagram {
  /** The canvas width, in the units the boxes are placed in. */
  width: number;
  /** The canvas height, in the same units. */
  height: number;
  /** The boxes, column by column, top to bottom. */
  nodes: readonly DiagramNode[];
  /** The arrows, in the order the columns declare them. */
  edges: readonly DiagramEdge[];
  /** The cardinality marks, one per arrow end that is not shared. */
  marks: readonly DiagramMark[];
}

/** The box, wide enough for the longest table name at 12.5px monospace. */
export const NODE_WIDTH = 168;
/** The box, tall enough for the name and the row count under it. */
export const NODE_HEIGHT = 42;
const COLUMN_GAP = 52;
const ROW_GAP = 10;
const PADDING = 8;
const CORNER = 6;
/** How far below the centre a second key enters a box, clear of the first. */
const SECONDARY_OFFSET = 10;

interface Reference {
  parent: string;
  child: string;
  label: string;
  unique: boolean;
  dashed: boolean;
}

/**
 * Place every table on a canvas and draw the keys between them.
 * @param tables - The tables to draw.
 * @returns The canvas, its boxes, its arrows and their cardinality marks.
 */
export function layoutSchema(
  tables: readonly TableInfo[] = SCHEMA,
): SchemaDiagram {
  const references = readReferences(tables);
  const { depths, rows, treeParents, rowTotal } = layoutRows(
    tables.map((table) => table.name),
    references,
  );

  let deepest = 0;
  for (const depth of depths.values()) deepest = Math.max(deepest, depth);
  const width =
    PADDING * 2 + (deepest + 1) * NODE_WIDTH + deepest * COLUMN_GAP;
  const height =
    PADDING * 2 + rowTotal * NODE_HEIGHT + Math.max(0, rowTotal - 1) * ROW_GAP;

  const nodes: DiagramNode[] = tables
    .map((table) => {
      const depth = depths.get(table.name) ?? 0;
      return {
        name: table.name,
        kind: table.kind,
        blurb: table.blurb,
        rowCount: table.rowCount,
        columns: table.columns,
        depth,
        x: PADDING + depth * (NODE_WIDTH + COLUMN_GAP),
        y: PADDING + (rows.get(table.name) ?? 0) * (NODE_HEIGHT + ROW_GAP),
      };
    })
    .toSorted((a, b) => a.depth - b.depth || a.y - b.y);

  const placed = new Map(nodes.map((node) => [node.name, node]));
  const edges: DiagramEdge[] = [];
  const marks = new Map<string, DiagramMark>();
  for (const reference of references) {
    const parent = placed.get(reference.parent);
    const child = placed.get(reference.child);
    if (!parent || !child) continue;
    const secondary = treeParents.get(reference.child) !== reference.parent;
    const x1 = parent.x + NODE_WIDTH;
    const y1 = parent.y + NODE_HEIGHT / 2;
    const x2 = child.x;
    const y2 = child.y + NODE_HEIGHT / 2 + (secondary ? SECONDARY_OFFSET : 0);
    edges.push({
      parent: reference.parent,
      child: reference.child,
      label: reference.label,
      cardinality: reference.unique ? '1:1' : '1:n',
      dashed: reference.dashed,
      secondary,
      path: elbow(x1, y1, x1 + COLUMN_GAP / 2, x2, y2),
    });
    addMark(marks, { x: x1 + 4, y: y1 - 4, text: '1', anchor: 'start' });
    addMark(marks, {
      x: x2 - 11,
      y: secondary ? y2 + 12 : y2 - 4,
      text: reference.unique ? '1' : 'n',
      anchor: 'end',
    });
  }

  return { width, height, nodes, edges, marks: [...marks.values()] };
}

/** The diagram of the shipped database, laid out once. */
export const SCHEMA_DIAGRAM: SchemaDiagram = layoutSchema();

function readReferences(tables: readonly TableInfo[]): Reference[] {
  const known = new Set(tables.map((table) => table.name));
  const references: Reference[] = [];
  for (const table of tables) {
    const drawn = new Set<string>();
    for (const column of table.columns) {
      const reference = column.references;
      if (!reference) continue;
      if (reference.table === table.name) continue;
      if (!known.has(reference.table) || drawn.has(reference.table)) continue;
      drawn.add(reference.table);
      references.push({
        parent: reference.table,
        child: table.name,
        label: `${reference.table}.${reference.column} → ${table.name}.${column.name}`,
        unique: column.unique === true,
        dashed: table.kind === 'view',
      });
    }
  }
  return references;
}

function addMark(marks: Map<string, DiagramMark>, mark: DiagramMark): void {
  marks.set(`${mark.x},${mark.y},${mark.text}`, mark);
}

function elbow(
  x1: number,
  y1: number,
  bus: number,
  x2: number,
  y2: number,
): string {
  const drop = y2 - y1;
  if (Math.abs(drop) < 0.5) return `M ${x1} ${y1} H ${x2}`;
  const radius = Math.min(CORNER, Math.abs(drop) / 2);
  const sign = Math.sign(drop);
  return [
    `M ${x1} ${y1}`,
    `H ${bus - radius}`,
    `Q ${bus} ${y1} ${bus} ${y1 + sign * radius}`,
    `V ${y2 - sign * radius}`,
    `Q ${bus} ${y2} ${bus + radius} ${y2}`,
    `H ${x2}`,
  ].join(' ');
}
