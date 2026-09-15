/** A key between two tables, as the tree layout needs it. */
export interface TreeLink {
  /** The table the key names. */
  parent: string;
  /** The table carrying the key. */
  child: string;
}

/** The column and row of every table, and the tree those rows came from. */
export interface TreeRows {
  /** The longest chain of keys from each table back to a root. */
  depths: Map<string, number>;
  /** The row each table is drawn on. */
  rows: Map<string, number>;
  /** The one parent each table hangs off in the tree. */
  treeParents: Map<string, string>;
  /** How many rows the drawing needs. */
  rowTotal: number;
}

/**
 * Lay the foreign-key graph out as a tree, one row per leaf.
 *
 * A table hangs off the deepest table it points at, so its column is one to the
 * right of its tree parent. A parent takes the row of the child nearest the
 * middle of its children, which keeps one arrow out of every parent level.
 * @param names - The tables, in the order siblings are stacked.
 * @param links - The keys between them.
 * @returns The depth and row of every table.
 */
export function layoutRows(
  names: readonly string[],
  links: readonly TreeLink[],
): TreeRows {
  const depths = measureDepths(names, links);

  const treeParents = new Map<string, string>();
  for (const link of links) {
    const depth = depths.get(link.parent) ?? 0;
    // Only a strictly shallower parent is kept, so a cycle of keys never
    // becomes a cycle of the tree.
    if (depth >= (depths.get(link.child) ?? 0)) continue;
    const current = treeParents.get(link.child);
    if (current === undefined || depth > (depths.get(current) ?? 0)) {
      treeParents.set(link.child, link.parent);
    }
  }

  const children = new Map<string, string[]>();
  for (const name of names) {
    const parent = treeParents.get(name);
    if (parent === undefined) continue;
    const list = children.get(parent);
    if (list) list.push(name);
    else children.set(parent, [name]);
  }

  const rows = new Map<string, number>();
  let rowTotal = 0;
  function place(name: string): number {
    const list = children.get(name);
    if (!list) {
      rows.set(name, rowTotal);
      return rowTotal++;
    }
    const childRows: number[] = [];
    for (const child of list) childRows.push(place(child));
    const first = childRows[0] ?? 0;
    const middle = (first + (childRows.at(-1) ?? 0)) / 2;
    let row = first;
    for (const childRow of childRows) {
      if (Math.abs(childRow - middle) < Math.abs(row - middle)) row = childRow;
    }
    rows.set(name, row);
    return row;
  }

  const alone: string[] = [];
  const rootRows = new Set<number>();
  for (const name of names) {
    if (treeParents.has(name)) continue;
    if (children.has(name)) rootRows.add(place(name));
    else alone.push(name);
  }

  // The first column holds nothing but roots, so a table with no key either
  // way fits in any row no root took, from the bottom up.
  let free = rowTotal - 1;
  for (const name of alone) {
    while (free >= 0 && rootRows.has(free)) free--;
    if (free < 0) {
      rows.set(name, rowTotal++);
    } else {
      rows.set(name, free);
      rootRows.add(free);
    }
  }

  return { depths, rows, treeParents, rowTotal };
}

function measureDepths(
  names: readonly string[],
  links: readonly TreeLink[],
): Map<string, number> {
  const parents = new Map<string, string[]>();
  for (const link of links) {
    const list = parents.get(link.child);
    if (list) list.push(link.parent);
    else parents.set(link.child, [link.parent]);
  }

  const depths = new Map<string, number>();
  // A key that came back to its own table would otherwise recurse forever; the
  // depth of such a table is whatever the rest of its keys make it.
  function depthOf(name: string, walking: Set<string>): number {
    const known = depths.get(name);
    if (known !== undefined) return known;
    if (walking.has(name)) return 0;
    walking.add(name);
    let depth = 0;
    for (const parent of parents.get(name) ?? []) {
      depth = Math.max(depth, depthOf(parent, walking) + 1);
    }
    walking.delete(name);
    depths.set(name, depth);
    return depth;
  }

  for (const name of names) depthOf(name, new Set());
  return depths;
}
