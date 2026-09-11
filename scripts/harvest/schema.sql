-- The shape of the chemistry the site hands to students.
--
-- A catalogue entry is one supplier's listing, and a physical property is that
-- listing's claim — which is why melting points, boiling points and densities
-- hang off the entry and not off the compound. Ask a compound for its boiling
-- point and you get a set of answers, each at its own pressure.

CREATE TABLE compounds (
  id                 INTEGER PRIMARY KEY,
  id_code            TEXT NOT NULL,
  id_code_no_stereo  TEXT NOT NULL UNIQUE,
  smiles             TEXT NOT NULL,
  molfile            TEXT,
  formula            TEXT NOT NULL,
  molecular_weight   REAL,
  monoisotopic_mass  REAL,
  charge             INTEGER NOT NULL DEFAULT 0,
  unsaturation       REAL,
  nb_atoms           INTEGER,
  nb_suppliers       INTEGER,
  preferred_name     TEXT
);

CREATE TABLE compound_elements (
  id           INTEGER PRIMARY KEY,
  compound_id  INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  count        INTEGER NOT NULL
);

CREATE TABLE names (
  id           INTEGER PRIMARY KEY,
  compound_id  INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  value        TEXT NOT NULL,
  language     TEXT NOT NULL DEFAULT 'en'
);

CREATE TABLE cas_numbers (
  id           INTEGER PRIMARY KEY,
  compound_id  INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  value        TEXT NOT NULL
);

CREATE TABLE catalog_entries (
  id           INTEGER PRIMARY KEY,
  compound_id  INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  entry_id     INTEGER NOT NULL UNIQUE,
  catalog_id   TEXT,
  supplier     TEXT,
  description  TEXT,
  purity       TEXT
);

CREATE TABLE melting_points (
  id                INTEGER PRIMARY KEY,
  catalog_entry_id  INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  low_c             REAL,
  high_c            REAL,
  sign              TEXT
);

CREATE TABLE boiling_points (
  id                INTEGER PRIMARY KEY,
  catalog_entry_id  INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  low_c             REAL,
  high_c            REAL,
  sign              TEXT,
  pressure_mmhg     REAL
);

CREATE TABLE densities (
  id                INTEGER PRIMARY KEY,
  catalog_entry_id  INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  low               REAL,
  high              REAL,
  temperature_c     REAL
);

CREATE TABLE flash_points (
  id                INTEGER PRIMARY KEY,
  catalog_entry_id  INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  low_c             REAL,
  high_c            REAL
);

CREATE TABLE hazard_statements (
  id                INTEGER PRIMARY KEY,
  catalog_entry_id  INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
  system            TEXT NOT NULL,   -- ghs-hazard, ghs-precaution, ghs-signal, risk, safety, symbol
  code              TEXT,
  description       TEXT
);

CREATE TABLE ir_spectra (
  id                INTEGER PRIMARY KEY,
  compound_id       INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  catalog_entry_id  INTEGER REFERENCES catalog_entries(id) ON DELETE SET NULL,
  source_id         TEXT NOT NULL,
  solvent           TEXT,
  conditions        TEXT,
  x_units           TEXT,
  y_units           TEXT,
  jcamp             TEXT NOT NULL
);

CREATE TABLE ir_peaks (
  id              INTEGER PRIMARY KEY,
  ir_spectrum_id  INTEGER NOT NULL REFERENCES ir_spectra(id) ON DELETE CASCADE,
  wavenumber      REAL NOT NULL,
  transmittance   REAL,
  absorbance      REAL,
  width           REAL,
  source          TEXT NOT NULL,   -- reported (by the supplier) or picked (by this build)
  assignment      TEXT
);

CREATE TABLE nmr_spectra (
  id                INTEGER PRIMARY KEY,
  compound_id       INTEGER NOT NULL REFERENCES compounds(id) ON DELETE CASCADE,
  catalog_entry_id  INTEGER REFERENCES catalog_entries(id) ON DELETE SET NULL,
  source_id         TEXT NOT NULL,
  nucleus           TEXT,
  solvent           TEXT,
  frequency_mhz     REAL,
  pulse_sequence    TEXT,
  spectrometer      TEXT,
  jcamp             TEXT NOT NULL
);

CREATE TABLE nmr_ranges (
  id               INTEGER PRIMARY KEY,
  nmr_spectrum_id  INTEGER NOT NULL REFERENCES nmr_spectra(id) ON DELETE CASCADE,
  from_ppm         REAL NOT NULL,
  to_ppm           REAL NOT NULL,
  integration      REAL
);

CREATE TABLE nmr_signals (
  id            INTEGER PRIMARY KEY,
  nmr_range_id  INTEGER NOT NULL REFERENCES nmr_ranges(id) ON DELETE CASCADE,
  delta_ppm     REAL NOT NULL,
  multiplicity  TEXT,
  kind          TEXT
);

CREATE TABLE nmr_couplings (
  id             INTEGER PRIMARY KEY,
  nmr_signal_id  INTEGER NOT NULL REFERENCES nmr_signals(id) ON DELETE CASCADE,
  coupling_hz    REAL NOT NULL,
  multiplicity   TEXT
);

-- The same compound, nested, for the Mango side of the playground.
CREATE TABLE documents (
  compound_id  INTEGER PRIMARY KEY REFERENCES compounds(id) ON DELETE CASCADE,
  doc          TEXT NOT NULL
);

CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE INDEX idx_names_compound        ON names(compound_id);
CREATE INDEX idx_names_value           ON names(value);
CREATE INDEX idx_names_language        ON names(language);
CREATE INDEX idx_elements_compound     ON compound_elements(compound_id);
CREATE INDEX idx_elements_symbol       ON compound_elements(symbol);
CREATE INDEX idx_cas_compound          ON cas_numbers(compound_id);
CREATE INDEX idx_entries_compound      ON catalog_entries(compound_id);
CREATE INDEX idx_mp_entry              ON melting_points(catalog_entry_id);
CREATE INDEX idx_bp_entry              ON boiling_points(catalog_entry_id);
CREATE INDEX idx_bp_pressure           ON boiling_points(pressure_mmhg);
CREATE INDEX idx_density_entry         ON densities(catalog_entry_id);
CREATE INDEX idx_fp_entry              ON flash_points(catalog_entry_id);
CREATE INDEX idx_hazard_entry          ON hazard_statements(catalog_entry_id);
CREATE INDEX idx_hazard_code           ON hazard_statements(code);
CREATE INDEX idx_ir_compound           ON ir_spectra(compound_id);
CREATE INDEX idx_ir_peaks_spectrum     ON ir_peaks(ir_spectrum_id);
CREATE INDEX idx_ir_peaks_wavenumber   ON ir_peaks(wavenumber);
CREATE INDEX idx_nmr_compound          ON nmr_spectra(compound_id);
CREATE INDEX idx_nmr_ranges_spectrum   ON nmr_ranges(nmr_spectrum_id);
CREATE INDEX idx_nmr_signals_range     ON nmr_signals(nmr_range_id);
CREATE INDEX idx_nmr_couplings_signal  ON nmr_couplings(nmr_signal_id);

-- One row per compound, with the counts a student most often wants first.
CREATE VIEW compound_overview AS
SELECT
  c.id,
  c.preferred_name AS name,
  c.formula,
  c.molecular_weight,
  c.smiles,
  c.nb_suppliers,
  (SELECT COUNT(*) FROM names n WHERE n.compound_id = c.id)            AS nb_names,
  (SELECT COUNT(*) FROM catalog_entries e WHERE e.compound_id = c.id)  AS nb_listings,
  (SELECT COUNT(*) FROM ir_spectra s WHERE s.compound_id = c.id)       AS nb_ir_spectra,
  (SELECT COUNT(*) FROM nmr_spectra s WHERE s.compound_id = c.id)      AS nb_nmr_spectra
FROM compounds c;

-- Every boiling point ever listed for a compound, with the pressure it was
-- measured at and the supplier who claims it.
CREATE VIEW boiling_point_claims AS
SELECT
  c.id AS compound_id,
  c.preferred_name AS name,
  c.formula,
  b.low_c,
  b.high_c,
  b.pressure_mmhg,
  e.supplier,
  e.entry_id
FROM boiling_points b
JOIN catalog_entries e ON e.id = b.catalog_entry_id
JOIN compounds c       ON c.id = e.compound_id;
