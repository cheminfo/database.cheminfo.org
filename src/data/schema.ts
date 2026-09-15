/**
 * The database, described for the /schema page.
 *
 * Every type, every foreign key and every row count below was read out of
 * `public/chem.sqlite` itself — `pragma_table_info`, `pragma_foreign_key_list`
 * and `COUNT(*)` — not copied from the file that created it. A column is
 * `nullable: false` when SQLite marks it `NOT NULL` or when it is the
 * `INTEGER PRIMARY KEY`, which is the rowid and can never be null. A view
 * declares no constraints at all, so a view column reports the nullability of
 * the column it reads.
 *
 * Where a column is declared nullable but is empty on every row of this
 * snapshot, the description says so: a student who queries it gets nothing
 * back, and the schema page is where that is cheapest to learn.
 */

/** One column of a table or a view. */
export interface ColumnInfo {
  /** The column name, as a query must spell it. */
  name: string;
  /** The type SQLite declares, empty when a view computes the column. */
  type: string;
  /** Whether the column accepts NULL. */
  nullable: boolean;
  /** What the column means, in one clause. */
  description: string;
  /**
   * The column this one points at: the foreign key on a table, and the column
   * a view reads on a view.
   * @default undefined — the column stands alone
   */
  references?: { table: string; column: string };
  /**
   * Whether no two rows share a value, which makes the key it carries one to
   * one rather than one to many.
   * @default false
   */
  unique?: boolean;
}

/** One table or view of the database. */
export interface TableInfo {
  /** The name a query uses. */
  name: string;
  /** Whether the rows are stored or computed. */
  kind: 'table' | 'view';
  /** The part of the diagram this belongs to. */
  group: 'compound' | 'catalogue' | 'ir' | 'nmr';
  /** What one row is, in one sentence. */
  blurb: string;
  /** The number of rows, counted in the shipped file. */
  rowCount: number;
  /** The columns, in the order SQLite returns them. */
  columns: readonly ColumnInfo[];
}

/** The four parts of the diagram, in the order a reader should meet them. */
export const SCHEMA_GROUPS: ReadonlyArray<{
  group: string;
  title: string;
  blurb: string;
}> = [
  {
    group: 'compound',
    title: 'The compound',
    blurb:
      'One row per compound, and the structure, names and registry numbers that hang off it.',
  },
  {
    group: 'catalogue',
    title: 'The catalogue',
    blurb:
      "One row per supplier listing, and the physical properties and hazards that listing claims.",
  },
  {
    group: 'ir',
    title: 'Infrared',
    blurb: 'One row per IR spectrum, and the bands inside it.',
  },
  {
    group: 'nmr',
    title: 'NMR',
    blurb:
      'One row per proton spectrum, then its ranges, its signals and their couplings.',
  },
];

/** What one row of each table means, in the sentences a student needs first. */
export const SCHEMA_STORY: readonly string[] = [
  'Start at the compounds table: one row per compound, 541 of them, and every other table points back at it.',
  'One structure hangs off each compound, with its molfile, its canonical SMILES and its masses; names and CAS numbers hang off it too, but each of those is a set — 2-Propanol carries 12 names across English, German and French.',
  'A physical property does not hang off the compound; it hangs off catalog_entries, one row per supplier listing, because a melting point or a density is a claim somebody printed in a catalogue.',
  'So asking a compound for its boiling point returns a set, never a number: 1,2-Diaminocyclohexane boils at 188 °C under 760 mmHg, at 104 °C under 40 mmHg, and at 79 °C under 15 mmHg.',
  'Spectra attach to the compound and then nest: an IR spectrum owns its peaks, and an NMR spectrum owns ranges, which own signals, which own couplings.',
  'The Mango side reads those same 541 compounds folded into one nested JSON document each, built in the page from these tables — the joins you write in SQL already made.',
];

const COMPOUND_KEY = { table: 'compounds', column: 'id' } as const;
const ENTRY_KEY = { table: 'catalog_entries', column: 'id' } as const;

/** The sixteen words of the substructure index, index00 holding bits 0 to 31. */
const INDEX_COLUMNS: readonly ColumnInfo[] = Array.from(
  { length: 16 },
  (_, word) => ({
    name: `index${String(word).padStart(2, '0')}`,
    type: 'INTEGER',
    nullable: false,
    description: `bits ${word * 32} to ${word * 32 + 31} of the substructure index, as an unsigned 32-bit number`,
  }),
);

/** Every table and view of the shipped database, parents before children. */
export const SCHEMA: readonly TableInfo[] = [
  {
    name: 'compounds',
    kind: 'table',
    group: 'compound',
    blurb: 'One row per compound, and the root every other table points at.',
    rowCount: 541,
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound key every other table joins on',
      },
      {
        name: 'id_code',
        type: 'TEXT',
        nullable: false,
        description: 'the OpenChemLib idcode, stereochemistry included',
      },
      {
        name: 'id_code_no_stereo',
        type: 'TEXT',
        nullable: false,
        description: 'the same idcode with stereochemistry stripped, unique across the table',
      },
      {
        name: 'formula',
        type: 'TEXT',
        nullable: false,
        description: 'the molecular formula, as in C2H6O',
      },
      {
        name: 'charge',
        type: 'INTEGER',
        nullable: false,
        description: 'the net charge, which is 0 on every compound here',
      },
      {
        name: 'unsaturation',
        type: 'REAL',
        nullable: true,
        description: 'the degree of unsaturation, empty on 7 compounds',
      },
      {
        name: 'nb_atoms',
        type: 'INTEGER',
        nullable: true,
        description: 'the atom count, hydrogens included',
      },
      {
        name: 'nb_suppliers',
        type: 'INTEGER',
        nullable: true,
        description: 'how many suppliers list the compound at the source, from 0 to 6073',
      },
      {
        name: 'preferred_name',
        type: 'TEXT',
        nullable: true,
        description: 'the name to show first, filled on every row',
      },
    ],
  },
  {
    name: 'structures',
    kind: 'table',
    group: 'compound',
    blurb:
      'One row per compound: how it is drawn, the masses computed from it, and the 512-bit index a substructure search screens on.',
    rowCount: 541,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound drawn, one structure each',
        references: COMPOUND_KEY,
        unique: true,
      },
      {
        name: 'molfile',
        type: 'TEXT',
        nullable: true,
        description: 'the structure as a molfile, present on all 541 rows',
      },
      {
        name: 'canonical_smiles',
        type: 'TEXT',
        nullable: false,
        description:
          'the isomeric SMILES OpenChemLib writes, the same string for the same structure, unique across the table',
      },
      {
        name: 'molecular_weight',
        type: 'REAL',
        nullable: true,
        description: 'the average molar mass in g/mol, from 17.03 to 671.1, present on every row',
      },
      {
        name: 'monoisotopic_mass',
        type: 'REAL',
        nullable: true,
        description: 'the mass computed from the most abundant isotope of each element',
      },
      ...INDEX_COLUMNS,
    ],
  },
  {
    name: 'names',
    kind: 'table',
    group: 'compound',
    blurb: 'One row per name of one compound, in one language.',
    rowCount: 2033,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound this name belongs to',
        references: COMPOUND_KEY,
      },
      {
        name: 'value',
        type: 'TEXT',
        nullable: false,
        description: 'one name, as the source spells it, accents and all missing',
      },
      {
        name: 'language',
        type: 'TEXT',
        nullable: false,
        description: 'en on 1395 rows, de on 629, fr on 9',
      },
    ],
  },
  {
    name: 'cas_numbers',
    kind: 'table',
    group: 'compound',
    blurb: 'One row per CAS registry number claimed for a compound.',
    rowCount: 771,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound this number identifies',
        references: COMPOUND_KEY,
      },
      {
        name: 'value',
        type: 'TEXT',
        nullable: false,
        description: 'the registry number as digits only, so ethanol is 64175 and not 64-17-5',
      },
    ],
  },
  {
    name: 'catalog_entries',
    kind: 'table',
    group: 'catalogue',
    blurb: "One row per supplier listing, which is what every physical property belongs to.",
    rowCount: 1049,
    columns: [
      {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing key the property tables join on',
      },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound being listed',
        references: COMPOUND_KEY,
      },
      {
        name: 'entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing identifier at the source, unique across the table',
      },
      {
        name: 'catalog_id',
        type: 'TEXT',
        nullable: true,
        description: "the supplier's own catalogue reference",
      },
      {
        name: 'supplier',
        type: 'TEXT',
        nullable: true,
        description:
          'who lists it: reference on 769 rows, AcrosOrganics on 170, MaybridgeBB on 110',
      },
      {
        name: 'description',
        type: 'TEXT',
        nullable: true,
        description: 'the label, grade and purity as one string, empty on 769 rows',
      },
      {
        name: 'purity',
        type: 'TEXT',
        nullable: true,
        description: 'empty on every row of this snapshot; read purity out of description instead',
      },
    ],
  },
  {
    name: 'melting_points',
    kind: 'table',
    group: 'catalogue',
    blurb: 'One row per melting point a listing claims.',
    rowCount: 736,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing that claims this value',
        references: ENTRY_KEY,
      },
      {
        name: 'low_c',
        type: 'REAL',
        nullable: true,
        description: 'the low end in °C, or the single value when there is no range',
      },
      {
        name: 'high_c',
        type: 'REAL',
        nullable: true,
        description: 'the high end in °C, empty on the 232 rows that give one value',
      },
      {
        name: 'sign',
        type: 'TEXT',
        nullable: true,
        description: '> on the 4 rows that report a bound rather than a value',
      },
    ],
  },
  {
    name: 'boiling_points',
    kind: 'table',
    group: 'catalogue',
    blurb: 'One row per boiling point a listing claims, at the pressure it was measured at.',
    rowCount: 558,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing that claims this value',
        references: ENTRY_KEY,
      },
      {
        name: 'low_c',
        type: 'REAL',
        nullable: true,
        description: 'the low end in °C, or the single value when there is no range',
      },
      {
        name: 'high_c',
        type: 'REAL',
        nullable: true,
        description: 'the high end in °C, empty on the 330 rows that give one value',
      },
      {
        name: 'sign',
        type: 'TEXT',
        nullable: true,
        description: 'empty on every row of this snapshot',
      },
      {
        name: 'pressure_mmhg',
        type: 'REAL',
        nullable: true,
        description: 'the pressure in mmHg, filled on every row, 760 being atmospheric',
      },
    ],
  },
  {
    name: 'densities',
    kind: 'table',
    group: 'catalogue',
    blurb: 'One row per density a listing claims.',
    rowCount: 434,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing that claims this value',
        references: ENTRY_KEY,
      },
      {
        name: 'low',
        type: 'REAL',
        nullable: true,
        description: 'the density in g/cm³, filled on every row',
      },
      {
        name: 'high',
        type: 'REAL',
        nullable: true,
        description: 'empty on every row of this snapshot',
      },
      {
        name: 'temperature_c',
        type: 'REAL',
        nullable: true,
        description: 'the temperature in °C, given on only 10 of the 434 rows',
      },
    ],
  },
  {
    name: 'flash_points',
    kind: 'table',
    group: 'catalogue',
    blurb: 'One row per flash point a listing claims.',
    rowCount: 106,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing that claims this value',
        references: ENTRY_KEY,
      },
      {
        name: 'low_c',
        type: 'REAL',
        nullable: true,
        description: 'the flash point in °C, filled on every row',
      },
      {
        name: 'high_c',
        type: 'REAL',
        nullable: true,
        description: 'empty on every row of this snapshot',
      },
    ],
  },
  {
    name: 'hazard_statements',
    kind: 'table',
    group: 'catalogue',
    blurb: 'One row per hazard, precaution or symbol a listing carries.',
    rowCount: 7423,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the listing that carries this statement',
        references: ENTRY_KEY,
      },
      {
        name: 'system',
        type: 'TEXT',
        nullable: false,
        description:
          'which vocabulary the code comes from: safety, risk, ghs-precaution, symbol, ghs-hazard or ghs-signal',
      },
      {
        name: 'code',
        type: 'TEXT',
        nullable: true,
        description: 'the code inside that system, as in R11, empty on 231 rows',
      },
      {
        name: 'description',
        type: 'TEXT',
        nullable: true,
        description: 'the sentence the code stands for, empty on 3 rows',
      },
    ],
  },
  {
    name: 'ir_spectra',
    kind: 'table',
    group: 'ir',
    blurb: 'One row per infrared spectrum, with the whole trace kept as JCAMP text.',
    rowCount: 171,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the spectrum key' },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound measured',
        references: COMPOUND_KEY,
      },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: true,
        description: 'the listing the spectrum came with, filled on every row',
        references: ENTRY_KEY,
      },
      {
        name: 'source_id',
        type: 'TEXT',
        nullable: false,
        description: 'the spectrum identifier at the source',
      },
      {
        name: 'solvent',
        type: 'TEXT',
        nullable: true,
        description: 'empty on every IR row of this snapshot',
      },
      {
        name: 'conditions',
        type: 'TEXT',
        nullable: true,
        description: 'empty on every IR row of this snapshot',
      },
      {
        name: 'x_units',
        type: 'TEXT',
        nullable: true,
        description: '1/CM on every row, so x is a wavenumber',
      },
      {
        name: 'y_units',
        type: 'TEXT',
        nullable: true,
        description: '% Transmittance on every row',
      },
      {
        name: 'jcamp',
        type: 'TEXT',
        nullable: false,
        description: 'the whole spectrum as JCAMP-DX text',
      },
    ],
  },
  {
    name: 'ir_peaks',
    kind: 'table',
    group: 'ir',
    blurb: 'One row per infrared band, either reported by the supplier or picked at build time.',
    rowCount: 4463,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'ir_spectrum_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the spectrum this band belongs to',
        references: { table: 'ir_spectra', column: 'id' },
      },
      {
        name: 'wavenumber',
        type: 'REAL',
        nullable: false,
        description: 'the band position in cm⁻¹',
      },
      {
        name: 'transmittance',
        type: 'REAL',
        nullable: true,
        description: 'the transmittance at that position, empty on 79 rows',
      },
      {
        name: 'absorbance',
        type: 'REAL',
        nullable: true,
        description: 'the absorbance at that position, empty on all 2492 reported bands',
      },
      {
        name: 'width',
        type: 'REAL',
        nullable: true,
        description: 'the fitted band width, empty on all 2492 reported bands',
      },
      {
        name: 'source',
        type: 'TEXT',
        nullable: false,
        description:
          "reported on 2492 rows, the supplier's own band list, and picked on 1971 found by ml-gsd at build time",
      },
      {
        name: 'assignment',
        type: 'TEXT',
        nullable: true,
        description: 'empty on every row of this snapshot',
      },
    ],
  },
  {
    name: 'nmr_spectra',
    kind: 'table',
    group: 'nmr',
    blurb: 'One row per proton spectrum, with the trimmed JCAMP kept alongside.',
    rowCount: 50,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the spectrum key' },
      {
        name: 'compound_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the compound measured',
        references: COMPOUND_KEY,
      },
      {
        name: 'catalog_entry_id',
        type: 'INTEGER',
        nullable: true,
        description: 'the listing the spectrum came with, filled on every row',
        references: ENTRY_KEY,
      },
      {
        name: 'source_id',
        type: 'TEXT',
        nullable: false,
        description: 'the spectrum identifier at the source',
      },
      {
        name: 'nucleus',
        type: 'TEXT',
        nullable: true,
        description: '1H on all 50 rows, so there is no carbon spectrum to find',
      },
      {
        name: 'solvent',
        type: 'TEXT',
        nullable: true,
        description: 'CDCl3 on 36 rows and DMSO on 14',
      },
      {
        name: 'frequency_mhz',
        type: 'REAL',
        nullable: true,
        description: 'the carrier frequency in MHz, 250 on 49 rows and 400 on one',
      },
      {
        name: 'pulse_sequence',
        type: 'TEXT',
        nullable: true,
        description:
          'the pulse programme the instrument ran, zg30 on 49 rows and zg on one',
      },
      {
        name: 'spectrometer',
        type: 'TEXT',
        nullable: true,
        description: 'the instrument, a dpx250 on 49 rows and a spect on one',
      },
      {
        name: 'jcamp',
        type: 'TEXT',
        nullable: false,
        description: 'the header and the real page of the export, without the instrument block',
      },
    ],
  },
  {
    name: 'nmr_ranges',
    kind: 'table',
    group: 'nmr',
    blurb: 'One row per integrated range of a spectrum.',
    rowCount: 292,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the range key' },
      {
        name: 'nmr_spectrum_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the spectrum this range was taken from',
        references: { table: 'nmr_spectra', column: 'id' },
      },
      {
        name: 'from_ppm',
        type: 'REAL',
        nullable: false,
        description: 'where the range starts, in ppm',
      },
      {
        name: 'to_ppm',
        type: 'REAL',
        nullable: false,
        description: 'where the range ends, in ppm',
      },
      {
        name: 'integration',
        type: 'REAL',
        nullable: true,
        description: 'the area under the range',
      },
    ],
  },
  {
    name: 'nmr_signals',
    kind: 'table',
    group: 'nmr',
    blurb: 'One row per signal found inside a range.',
    rowCount: 307,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the signal key' },
      {
        name: 'nmr_range_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the range this signal sits in',
        references: { table: 'nmr_ranges', column: 'id' },
      },
      {
        name: 'delta_ppm',
        type: 'REAL',
        nullable: false,
        description: 'the chemical shift, in ppm',
      },
      {
        name: 'multiplicity',
        type: 'TEXT',
        nullable: true,
        description: 'the pattern, m and s and d being the three commonest',
      },
      {
        name: 'kind',
        type: 'TEXT',
        nullable: true,
        description: 'signal on 304 rows and impurity on 3',
      },
    ],
  },
  {
    name: 'nmr_couplings',
    kind: 'table',
    group: 'nmr',
    blurb: 'One row per coupling constant read off a signal.',
    rowCount: 197,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, description: 'the row key' },
      {
        name: 'nmr_signal_id',
        type: 'INTEGER',
        nullable: false,
        description: 'the signal this coupling was read from',
        references: { table: 'nmr_signals', column: 'id' },
      },
      {
        name: 'coupling_hz',
        type: 'REAL',
        nullable: false,
        description: 'the coupling constant J, in Hz',
      },
      {
        name: 'multiplicity',
        type: 'TEXT',
        nullable: true,
        description: 'the splitting this constant produces: d, t, q or quint',
      },
    ],
  },
];
