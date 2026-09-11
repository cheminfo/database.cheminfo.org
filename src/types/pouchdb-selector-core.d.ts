/**
 * Types for `pouchdb-selector-core`, which ships none of its own.
 *
 * Only the four entry points this site uses are declared. The package is
 * CouchDB's selector engine as PouchDB implements it, so the shapes here are
 * the ones a Mango query is written in.
 */
declare module 'pouchdb-selector-core' {
  /** A Mango selector, as `{"charge": {"$gt": 0}}`. */
  export type Selector = Record<string, unknown>;

  /** A document the selector is matched against. */
  export type Doc = Record<string, unknown>;

  /**
   * Bring a selector to the normal form the matcher expects.
   * @param selector - The selector as written.
   * @returns The normalized selector.
   */
  export function massageSelector(selector: Selector): Selector;

  /**
   * Whether a document satisfies a normalized selector.
   * @param doc - The document.
   * @param selector - A selector already passed through `massageSelector`.
   * @returns True when the document matches.
   */
  export function matchesSelector(doc: Doc, selector: Selector): boolean;

  /**
   * Split a dotted field path into its segments.
   * @param field - The path, as `nmr.solvent`.
   * @returns One segment per level.
   */
  export function parseField(field: string): string[];

  /**
   * Read a value out of a document by parsed path.
   * @param doc - The document.
   * @param path - The path, as `parseField` returns it.
   * @returns The value, or undefined when the path is absent.
   */
  export function getFieldFromDoc(doc: Doc, path: string[]): unknown;

  /**
   * Build the comparator a Mango `sort` describes.
   * @param sort - One entry per field, each naming a direction.
   * @returns A comparator over `{ doc }` rows.
   */
  export function createFieldSorter(
    sort: Array<Record<string, 'asc' | 'desc'>>,
  ): (a: { doc: Doc }, b: { doc: Doc }) => number;
}
