import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';

/** One compound nested with everything that points at it, as Mango reads it. */
export type MangoDocument = Record<string, unknown>;

type Row = SqlValue[];

/**
 * Fold the tables into one nested document per compound, for the Mango side.
 *
 * The database stores rows only, and this is the join SQL writes, done once in
 * the page: names, CAS numbers and listings under the compound, the claims
 * under each listing, peaks under an IR spectrum, and ranges, signals and
 * couplings under an NMR spectrum. Each table is read in one pass and grouped
 * by the key it carries, so the cost is one scan per table rather than one
 * query per compound.
 * @param database - The opened database.
 * @returns One document per compound, ordered by compound id.
 */
export function buildDocuments(database: Database): MangoDocument[] {
  const names = groupBy(database, 'SELECT compound_id, value, language FROM names', (row) => ({
    value: row[1],
    language: row[2],
  }));
  const cas = groupBy(database, 'SELECT compound_id, value FROM cas_numbers', (row) => row[1]);

  const meltingPoints = groupBy(
    database,
    'SELECT catalog_entry_id, low_c, high_c, sign FROM melting_points',
    (row) => ({ low: row[1], high: row[2], sign: row[3] }),
  );
  const boilingPoints = groupBy(
    database,
    'SELECT catalog_entry_id, low_c, high_c, sign, pressure_mmhg FROM boiling_points',
    (row) => ({ low: row[1], high: row[2], sign: row[3], pressure: row[4] }),
  );
  const densities = groupBy(
    database,
    'SELECT catalog_entry_id, low, high, temperature_c FROM densities',
    (row) => ({ low: row[1], high: row[2], temperature: row[3] }),
  );
  const flashPoints = groupBy(
    database,
    'SELECT catalog_entry_id, low_c, high_c FROM flash_points',
    (row) => ({ low: row[1], high: row[2] }),
  );
  const hazards = groupBy(
    database,
    'SELECT catalog_entry_id, system, code, description FROM hazard_statements',
    (row) => ({ system: row[1], code: row[2], description: row[3] }),
  );
  const listings = groupBy(
    database,
    'SELECT compound_id, id, entry_id, catalog_id, supplier, description, purity FROM catalog_entries',
    (row) => ({
      entryId: row[2],
      catalogId: row[3],
      supplier: row[4],
      description: row[5],
      purity: row[6],
      meltingPoints: meltingPoints.get(row[1]) ?? [],
      boilingPoints: boilingPoints.get(row[1]) ?? [],
      densities: densities.get(row[1]) ?? [],
      flashPoints: flashPoints.get(row[1]) ?? [],
      hazards: hazards.get(row[1]) ?? [],
    }),
  );

  const irPeaks = groupBy(
    database,
    'SELECT ir_spectrum_id, wavenumber, transmittance, absorbance, source FROM ir_peaks',
    (row) => ({ wavenumber: row[1], transmittance: row[2], absorbance: row[3], source: row[4] }),
  );
  const irSpectra = groupBy(
    database,
    'SELECT compound_id, id, source_id, solvent FROM ir_spectra',
    (row) => ({ sourceId: row[2], solvent: row[3], peaks: irPeaks.get(row[1]) ?? [] }),
  );

  const couplings = groupBy(
    database,
    'SELECT nmr_signal_id, coupling_hz, multiplicity FROM nmr_couplings',
    (row) => ({ coupling: row[1], multiplicity: row[2] }),
  );
  const signals = groupBy(
    database,
    'SELECT nmr_range_id, id, delta_ppm, multiplicity FROM nmr_signals',
    (row) => ({ delta: row[2], multiplicity: row[3], couplings: couplings.get(row[1]) ?? [] }),
  );
  const ranges = groupBy(
    database,
    'SELECT nmr_spectrum_id, id, from_ppm, to_ppm, integration FROM nmr_ranges',
    (row) => ({ from: row[2], to: row[3], integration: row[4], signals: signals.get(row[1]) ?? [] }),
  );
  const nmrSpectra = groupBy(
    database,
    'SELECT compound_id, id, source_id, nucleus, solvent, frequency_mhz FROM nmr_spectra',
    (row) => ({
      sourceId: row[2],
      nucleus: row[3],
      solvent: row[4],
      frequency: row[5],
      ranges: ranges.get(row[1]) ?? [],
    }),
  );

  const documents: MangoDocument[] = [];
  readRows(
    database,
    `SELECT c.id, c.preferred_name, c.formula, s.molecular_weight, s.monoisotopic_mass,
            c.charge, c.unsaturation, s.canonical_smiles, c.nb_suppliers
     FROM compounds c JOIN structures s ON s.compound_id = c.id
     ORDER BY c.id`,
    (row) => {
      const id = row[0];
      documents.push({
        _id: `compound:${Number(id)}`,
        name: row[1],
        formula: row[2],
        mass: row[3],
        monoisotopicMass: row[4],
        charge: row[5],
        unsaturation: row[6],
        smiles: row[7],
        nbSuppliers: row[8],
        names: names.get(id) ?? [],
        cas: cas.get(id) ?? [],
        listings: listings.get(id) ?? [],
        ir: irSpectra.get(id) ?? [],
        nmr: nmrSpectra.get(id) ?? [],
      });
    },
  );
  return documents;
}

function groupBy<T>(database: Database, sql: string, read: (row: Row) => T): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  readRows(database, `${sql} ORDER BY id`, (row) => {
    const key = row[0];
    const group = groups.get(key);
    if (group) group.push(read(row));
    else groups.set(key, [read(row)]);
  });
  return groups;
}

function readRows(database: Database, sql: string, onRow: (row: Row) => void): void {
  const statement = database.prepare(sql);
  try {
    while (statement.step()) onRow(statement.get([]));
  } finally {
    statement.finalize();
  }
}
