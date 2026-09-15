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
  formula            TEXT NOT NULL,
  charge             INTEGER NOT NULL DEFAULT 0,
  unsaturation       REAL,
  nb_atoms           INTEGER,
  nb_suppliers       INTEGER,
  preferred_name     TEXT
);

-- The structure a compound is drawn as, the masses computed from it, and its
-- substructure index: OpenChemLib's 512-bit fingerprint as sixteen unsigned
-- 32-bit words, bit 0 being the high bit of index00. A query can only be found
-- in a structure holding every bit the query holds, so
-- `(index00 & q) = q AND …` screens candidates before any atom is compared.
CREATE TABLE structures (
  id                 INTEGER PRIMARY KEY,
  compound_id        INTEGER NOT NULL UNIQUE REFERENCES compounds(id) ON DELETE CASCADE,
  molfile            TEXT,
  canonical_smiles   TEXT NOT NULL,
  molecular_weight   REAL,
  monoisotopic_mass  REAL,
  index00            INTEGER NOT NULL,
  index01            INTEGER NOT NULL,
  index02            INTEGER NOT NULL,
  index03            INTEGER NOT NULL,
  index04            INTEGER NOT NULL,
  index05            INTEGER NOT NULL,
  index06            INTEGER NOT NULL,
  index07            INTEGER NOT NULL,
  index08            INTEGER NOT NULL,
  index09            INTEGER NOT NULL,
  index10            INTEGER NOT NULL,
  index11            INTEGER NOT NULL,
  index12            INTEGER NOT NULL,
  index13            INTEGER NOT NULL,
  index14            INTEGER NOT NULL,
  index15            INTEGER NOT NULL
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

CREATE INDEX idx_structures_weight     ON structures(molecular_weight);
CREATE INDEX idx_names_compound        ON names(compound_id);
CREATE INDEX idx_names_value           ON names(value);
CREATE INDEX idx_names_language        ON names(language);
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
