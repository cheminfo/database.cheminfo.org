import type { Database, SqlValue } from '@sqlite.org/sqlite-wasm';

/** One name a compound answers to. */
export interface CompoundName {
  value: string;
  language: string;
}

/** A physical property one listing claims. */
export interface PropertyClaim {
  low: number | null;
  high: number | null;
  /** The pressure a boiling point was measured at, in mmHg. */
  pressure?: number | null;
  /** The temperature a density was measured at, in °C. */
  temperature?: number | null;
}

export interface HazardStatement {
  id: number;
  system: string;
  code: string | null;
  description: string | null;
}

export interface Listing {
  id: number;
  entryId: number;
  catalogId: string | null;
  supplier: string | null;
  description: string | null;
  purity: string | null;
  meltingPoints: PropertyClaim[];
  boilingPoints: PropertyClaim[];
  densities: PropertyClaim[];
  flashPoints: PropertyClaim[];
  hazards: HazardStatement[];
}

export interface IrPeak {
  wavenumber: number;
  transmittance: number | null;
  absorbance: number | null;
  /** `reported` by the supplier, or `picked` by this build. */
  source: string;
}

export interface IrSpectrum {
  id: number;
  sourceId: string;
  solvent: string | null;
  conditions: string | null;
  xUnits: string | null;
  yUnits: string | null;
  jcamp: string;
  peaks: IrPeak[];
}

export interface NmrCoupling {
  coupling: number;
  multiplicity: string | null;
}

export interface NmrSignal {
  id: number;
  delta: number;
  multiplicity: string | null;
  couplings: NmrCoupling[];
}

export interface NmrRange {
  id: number;
  from: number;
  to: number;
  integration: number | null;
  signals: NmrSignal[];
}

export interface NmrSpectrum {
  id: number;
  sourceId: string;
  nucleus: string | null;
  solvent: string | null;
  frequency: number | null;
  pulseSequence: string | null;
  spectrometer: string | null;
  jcamp: string;
  ranges: NmrRange[];
}

/**
 * One compound as the browsing list shows it: a row of `compounds` joined to
 * its row of `structures`.
 */
export interface CompoundSummary {
  /** `compounds.id`. */
  id: number;
  /** `compounds.preferred_name`. */
  name: string | null;
  /** `compounds.formula`. */
  formula: string;
  /** `structures.molecular_weight`, in g/mol. */
  mass: number | null;
  /** `structures.canonical_smiles`, OpenChemLib's isomeric SMILES; empty when no structure row exists. */
  smiles: string;
  /** `compounds.nb_suppliers`. */
  nbSuppliers: number | null;
}

/** One compound with its structure and every row that points at it. */
export interface CompoundDetail extends CompoundSummary {
  /** `compounds.id_code`, the OpenChemLib id code. */
  idCode: string;
  /** `structures.monoisotopic_mass`. */
  monoisotopicMass: number | null;
  /** `compounds.charge`. */
  charge: number;
  /** `compounds.unsaturation`. */
  unsaturation: number | null;
  /** `compounds.nb_atoms`. */
  nbAtoms: number | null;
  /** `structures.molfile`. */
  molfile: string | null;
  names: CompoundName[];
  cas: string[];
  listings: Listing[];
  ir: IrSpectrum[];
  nmr: NmrSpectrum[];
}

function all(database: Database, sql: string, ...params: SqlValue[]): SqlValue[][] {
  const statement = database.prepare(sql);
  const rows: SqlValue[][] = [];
  try {
    if (params.length > 0) statement.bind(params);
    while (statement.step()) rows.push(statement.get([]));
  } finally {
    statement.finalize();
  }
  return rows;
}

/**
 * A numeric column, or null.
 *
 * `noUncheckedIndexedAccess` makes every column read possibly absent, and a
 * column may also come back as a blob, which is not a number.
 * @param value - The column as read.
 * @returns The number, or null.
 */
function number(value: SqlValue | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * A text column, or null. A blob is not text and comes back as null rather
 * than as `[object Object]`.
 * @param value - The column as read.
 * @returns The text, or null.
 */
function string(value: SqlValue | undefined): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  return null;
}

/**
 * A column the schema declares `NOT NULL`.
 * @param value - The column as read.
 * @returns The text, empty when the column held something that is not text.
 */
function required(value: SqlValue | undefined): string {
  return string(value) ?? '';
}

/**
 * Every compound, as the browsing list shows them.
 * @param database - The opened database.
 * @returns One summary per compound, ordered by name.
 */
export function readCompounds(database: Database): CompoundSummary[] {
  return all(
    database,
    `SELECT c.id, c.preferred_name, c.formula, s.molecular_weight,
            s.canonical_smiles, c.nb_suppliers
     FROM compounds c LEFT JOIN structures s ON s.compound_id = c.id
     ORDER BY c.preferred_name COLLATE NOCASE`,
  ).map((row) => ({
    id: (number(row[0]) ?? 0),
    name: string(row[1]),
    formula: required(row[2]),
    mass: number(row[3]),
    smiles: required(row[4]),
    nbSuppliers: number(row[5]),
  }));
}

/**
 * One compound, its structure, and everything that hangs off it.
 *
 * Read in full rather than lazily: the point of the page is to see the whole
 * 1-to-many shape at once — every name, every listing's own claims, every peak
 * and every coupling — and 541 compounds is small enough that the query costs
 * less than deciding what to defer.
 * @param database - The opened database.
 * @param id - The compound.
 * @returns The compound, or null when the id names none.
 */
export function readCompound(database: Database, id: number): CompoundDetail | null {
  const head = all(
    database,
    `SELECT c.id, c.preferred_name, c.formula, s.molecular_weight,
            s.canonical_smiles, c.nb_suppliers, c.id_code, s.monoisotopic_mass,
            c.charge, c.unsaturation, c.nb_atoms, s.molfile
     FROM compounds c LEFT JOIN structures s ON s.compound_id = c.id
     WHERE c.id = ?`,
    id,
  )[0];
  if (!head) return null;

  const listings: Listing[] = all(
    database,
    `SELECT id, entry_id, catalog_id, supplier, description, purity
     FROM catalog_entries WHERE compound_id = ? ORDER BY entry_id`,
    id,
  ).map((row) => {
    const listingId = (number(row[0]) ?? 0);
    return {
      id: listingId,
      entryId: (number(row[1]) ?? 0),
      catalogId: string(row[2]),
      supplier: string(row[3]),
      description: string(row[4]),
      purity: string(row[5]),
      meltingPoints: all(
        database,
        'SELECT low_c, high_c FROM melting_points WHERE catalog_entry_id = ?',
        listingId,
      ).map((claim) => ({ low: number(claim[0]), high: number(claim[1]) })),
      boilingPoints: all(
        database,
        'SELECT low_c, high_c, pressure_mmhg FROM boiling_points WHERE catalog_entry_id = ?',
        listingId,
      ).map((claim) => ({
        low: number(claim[0]),
        high: number(claim[1]),
        pressure: number(claim[2]),
      })),
      densities: all(
        database,
        'SELECT low, high, temperature_c FROM densities WHERE catalog_entry_id = ?',
        listingId,
      ).map((claim) => ({
        low: number(claim[0]),
        high: number(claim[1]),
        temperature: number(claim[2]),
      })),
      flashPoints: all(
        database,
        'SELECT low_c, high_c FROM flash_points WHERE catalog_entry_id = ?',
        listingId,
      ).map((claim) => ({ low: number(claim[0]), high: number(claim[1]) })),
      hazards: all(
        database,
        `SELECT id, system, code, description FROM hazard_statements
         WHERE catalog_entry_id = ? ORDER BY system, code`,
        listingId,
      ).map((row2) => ({
        id: number(row2[0]) ?? 0,
        system: required(row2[1]),
        code: string(row2[2]),
        description: string(row2[3]),
      })),
    };
  });

  const ir: IrSpectrum[] = all(
    database,
    `SELECT id, source_id, solvent, conditions, x_units, y_units, jcamp
     FROM ir_spectra WHERE compound_id = ? ORDER BY id`,
    id,
  ).map((row) => {
    const spectrumId = (number(row[0]) ?? 0);
    return {
      id: spectrumId,
      sourceId: required(row[1]),
      solvent: string(row[2]),
      conditions: string(row[3]),
      xUnits: string(row[4]),
      yUnits: string(row[5]),
      jcamp: required(row[6]),
      peaks: all(
        database,
        `SELECT wavenumber, transmittance, absorbance, source
         FROM ir_peaks WHERE ir_spectrum_id = ? ORDER BY wavenumber`,
        spectrumId,
      ).map((peak) => ({
        wavenumber: (number(peak[0]) ?? 0),
        transmittance: number(peak[1]),
        absorbance: number(peak[2]),
        source: required(peak[3]),
      })),
    };
  });

  const nmr: NmrSpectrum[] = all(
    database,
    `SELECT id, source_id, nucleus, solvent, frequency_mhz, pulse_sequence,
            spectrometer, jcamp
     FROM nmr_spectra WHERE compound_id = ? ORDER BY id`,
    id,
  ).map((row) => {
    const spectrumId = (number(row[0]) ?? 0);
    return {
      id: spectrumId,
      sourceId: required(row[1]),
      nucleus: string(row[2]),
      solvent: string(row[3]),
      frequency: number(row[4]),
      pulseSequence: string(row[5]),
      spectrometer: string(row[6]),
      jcamp: required(row[7]),
      ranges: all(
        database,
        `SELECT id, from_ppm, to_ppm, integration FROM nmr_ranges
         WHERE nmr_spectrum_id = ? ORDER BY from_ppm DESC`,
        spectrumId,
      ).map((range) => {
        const rangeId = (number(range[0]) ?? 0);
        return {
          id: rangeId,
          from: (number(range[1]) ?? 0),
          to: (number(range[2]) ?? 0),
          integration: number(range[3]),
          signals: all(
            database,
            `SELECT id, delta_ppm, multiplicity FROM nmr_signals
             WHERE nmr_range_id = ? ORDER BY delta_ppm DESC`,
            rangeId,
          ).map((signal) => {
            const signalId = (number(signal[0]) ?? 0);
            return {
              id: signalId,
              delta: (number(signal[1]) ?? 0),
              multiplicity: string(signal[2]),
              couplings: all(
                database,
                `SELECT coupling_hz, multiplicity FROM nmr_couplings
                 WHERE nmr_signal_id = ? ORDER BY coupling_hz DESC`,
                signalId,
              ).map((coupling) => ({
                coupling: (number(coupling[0]) ?? 0),
                multiplicity: string(coupling[1]),
              })),
            };
          }),
        };
      }),
    };
  });

  return {
    id: (number(head[0]) ?? 0),
    name: string(head[1]),
    formula: required(head[2]),
    mass: number(head[3]),
    smiles: required(head[4]),
    nbSuppliers: number(head[5]),
    idCode: required(head[6]),
    monoisotopicMass: number(head[7]),
    charge: number(head[8]) ?? 0,
    unsaturation: number(head[9]),
    nbAtoms: number(head[10]),
    molfile: string(head[11]),
    names: all(
      database,
      'SELECT value, language FROM names WHERE compound_id = ? ORDER BY language, value',
      id,
    ).map((row) => ({ value: required(row[0]), language: required(row[1]) })),
    cas: all(database, 'SELECT value FROM cas_numbers WHERE compound_id = ?', id).map((row) =>
      required(row[0]),
    ),
    listings,
    ir,
    nmr,
  };
}
