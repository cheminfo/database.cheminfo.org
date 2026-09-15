/**
 * Assemble the SQLite database the browser downloads.
 *
 * Everything here is measured data: catalogue records as ChemExper serves
 * them, the original JCAMP-DX of every spectrum, and peak lists produced by
 * the cheminfo pickers at build time. Prices are the one thing deliberately
 * dropped — the site teaches querying, not purchasing.
 */
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gzipSync } from 'node:zlib';

import OCL from 'openchemlib';

import { readJson } from './lib.mjs';
import { reduceNmrJcamp } from './nmr-lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const OUT = join(import.meta.dirname, '../../public/chem.sqlite');

await rm(OUT, { force: true });
const db = new DatabaseSync(OUT);
db.exec('PRAGMA journal_mode = OFF');
db.exec('PRAGMA synchronous = OFF');
db.exec(await readFile(join(import.meta.dirname, 'schema.sql'), 'utf8'));

// The substructure index as sixteen unsigned 32-bit words, index00 to index15:
// bit 0 is the high bit of index00, as OpenChemLib's getIndex() sets it.
const INDEX_COLUMNS = Array.from({ length: 16 }, (_, word) => `index${String(word).padStart(2, '0')}`);

const compounds = await readJson(join(RAW, 'compounds.json'));
const irPicked = await readJson(join(RAW, 'ir-picked.json'));
const nmrPicked = await readJson(join(RAW, 'nmr-picked.json'));

const irByStructure = new Map();
for (const record of irPicked) {
  const list = irByStructure.get(record.idCodeNoStereo) ?? [];
  list.push(record);
  irByStructure.set(record.idCodeNoStereo, list);
}
const nmrByStructure = new Map();
for (const record of nmrPicked) {
  const list = nmrByStructure.get(record.idCodeNoStereo) ?? [];
  list.push(record);
  nmrByStructure.set(record.idCodeNoStereo, list);
}

const insert = {
  compound: db.prepare(
    `INSERT INTO compounds (id_code, id_code_no_stereo, formula, charge, unsaturation, nb_atoms,
      nb_suppliers, preferred_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
  structure: db.prepare(
    `INSERT INTO structures (compound_id, molfile, canonical_smiles, molecular_weight, monoisotopic_mass,
      ${INDEX_COLUMNS.join(', ')})
     VALUES (?, ?, ?, ?, ?, ${INDEX_COLUMNS.map(() => '?').join(', ')})`,
  ),
  name: db.prepare('INSERT INTO names (compound_id, value, language) VALUES (?, ?, ?)'),
  cas: db.prepare('INSERT INTO cas_numbers (compound_id, value) VALUES (?, ?)'),
  entry: db.prepare(
    `INSERT INTO catalog_entries (compound_id, entry_id, catalog_id, supplier, description, purity)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ),
  mp: db.prepare('INSERT INTO melting_points (catalog_entry_id, low_c, high_c, sign) VALUES (?, ?, ?, ?)'),
  bp: db.prepare(
    'INSERT INTO boiling_points (catalog_entry_id, low_c, high_c, sign, pressure_mmhg) VALUES (?, ?, ?, ?, ?)',
  ),
  density: db.prepare('INSERT INTO densities (catalog_entry_id, low, high, temperature_c) VALUES (?, ?, ?, ?)'),
  fp: db.prepare('INSERT INTO flash_points (catalog_entry_id, low_c, high_c) VALUES (?, ?, ?)'),
  hazard: db.prepare(
    'INSERT INTO hazard_statements (catalog_entry_id, system, code, description) VALUES (?, ?, ?, ?)',
  ),
  irSpectrum: db.prepare(
    `INSERT INTO ir_spectra (compound_id, catalog_entry_id, source_id, solvent, conditions,
      x_units, y_units, jcamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
  irPeak: db.prepare(
    `INSERT INTO ir_peaks (ir_spectrum_id, wavenumber, transmittance, absorbance, width, source, assignment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ),
  nmrSpectrum: db.prepare(
    `INSERT INTO nmr_spectra (compound_id, catalog_entry_id, source_id, nucleus, solvent, frequency_mhz,
      pulse_sequence, spectrometer, jcamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ),
  nmrRange: db.prepare(
    'INSERT INTO nmr_ranges (nmr_spectrum_id, from_ppm, to_ppm, integration) VALUES (?, ?, ?, ?)',
  ),
  nmrSignal: db.prepare(
    'INSERT INTO nmr_signals (nmr_range_id, delta_ppm, multiplicity, kind) VALUES (?, ?, ?, ?)',
  ),
  nmrCoupling: db.prepare(
    'INSERT INTO nmr_couplings (nmr_signal_id, coupling_hz, multiplicity) VALUES (?, ?, ?)',
  ),
};

/** A number the source may have left as an empty string. */
function number(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Round to the precision the measurement actually carries.
 *
 * A picked range boundary comes back as 6.61801116145911 ppm, which is fifteen
 * digits of a number a 250 MHz spectrum resolves to about four: storing the
 * rest is false precision, and it makes every result table unreadable.
 * @param value - The value, or null.
 * @param digits - Decimals to keep.
 * @returns The rounded value, or null.
 */
function round(value, digits) {
  const parsed = number(value);
  return parsed === null ? null : Number(parsed.toFixed(digits));
}

function text(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? null : trimmed;
}

/**
 * Write a CAS registry number the way a chemist reads it.
 *
 * The source stores it as bare digits — ethanol is `64175` — but a CAS number
 * is `64-17-5`, and its last digit is a checksum over the others, so the
 * split can be verified rather than assumed. A number that fails its own
 * check digit is kept as it was found.
 * @param digits - The registry number as stored.
 * @returns The hyphenated form, or the input when it does not check out.
 */
function formatCas(digits) {
  const clean = String(digits).replaceAll(/\D/g, '');
  if (clean.length < 5 || clean.length > 10) return String(digits);
  const body = clean.slice(0, -3);
  const middle = clean.slice(-3, -1);
  const check = Number(clean.slice(-1));
  const stem = `${body}${middle}`;
  let sum = 0;
  for (let i = 0; i < stem.length; i++) {
    sum += Number(stem[stem.length - 1 - i]) * (i + 1);
  }
  if (sum % 10 !== check) return String(digits);
  return `${body}-${middle}-${check}`;
}

/** The name a student would recognise, out of everything the suppliers call it. */
function preferredName(names) {
  const english = names.filter((n) => n.language === 'en').map((n) => n.value);
  const pool = english.length ? english : names.map((n) => n.value);
  const clean = pool.filter((n) => !/^(zinc|ai3-|einecs|albb|nsc\d|brn|ccris|caswell)/i.test(n));
  const usable = clean.length ? clean : pool;
  // Prefer a short name, but not an abbreviation. Three letters is never a
  // chemical name — Tol, His, Met and Cyt are all abbreviations — and a short
  // string with two capitals is one too, as EtOH and DMSO are.
  const scored = usable.map((name) => {
    let penalty = 0;
    if (name.length <= 3) penalty += 200;
    if (name.length <= 6 && (name.match(/[A-Z]/g) ?? []).length >= 2) penalty += 100;
    if (/^[A-Za-z]{1,3}[\s-]?\d+$/.test(name)) penalty += 150;
    return { name, score: penalty + name.length };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.name ?? null;
}

/** Every atom of the structure, hydrogens included, or null when it cannot be read. */
function atomCountOf(molfile, smiles) {
  try {
    const molecule = molfile ? OCL.Molecule.fromMolfile(molfile) : OCL.Molecule.fromSmiles(smiles);
    molecule.addImplicitHydrogens();
    return molecule.getAllAtoms();
  } catch {
    return null;
  }
}

const stats = {
  compounds: 0, structures: 0, names: 0, cas: 0, entries: 0,
  mp: 0, bp: 0, densities: 0, fp: 0, hazards: 0,
  irSpectra: 0, irPeaks: 0, nmrSpectra: 0, nmrRanges: 0, nmrSignals: 0, nmrCouplings: 0,
};

db.exec('BEGIN');

for (const compound of compounds) {
  const primary = compound.records[0];
  const formula = (primary?.mf?.[0]?.value?.value ?? compound.dumpEntries[0]?.mf?.mf ?? '').replaceAll(' ', '');

  // Names, from every listing, in every language the suppliers wrote them in.
  const nameSet = new Map();
  for (const record of compound.records) {
    for (const entry of Array.isArray(record.iupac) ? record.iupac : []) {
      const value = text(entry.value);
      if (value) nameSet.set(`${entry.language}|${value.toLowerCase()}`, { value, language: entry.language || 'en' });
    }
  }
  for (const dump of compound.dumpEntries) {
    for (const value of dump.iupac ?? []) {
      const clean = text(value);
      if (clean) nameSet.set(`en|${clean.toLowerCase()}`, { value: clean, language: 'en' });
    }
  }
  const names = [...nameSet.values()];

  const molfile = primary?.mol?.[0]?.value?.value ?? null;
  const dumpMf = compound.dumpEntries[0]?.mf;
  const nbAtoms = atomCountOf(molfile, compound.smiles);

  const compoundId = insert.compound.run(
    compound.idCode,
    compound.idCodeNoStereo,
    formula,
    number(dumpMf?.charge) ?? 0,
    number(dumpMf?.unsaturation),
    nbAtoms,
    compound.nbSuppliers ?? null,
    preferredName(names),
  ).lastInsertRowid;
  stats.compounds++;

  const molecule = OCL.Molecule.fromIDCode(compound.idCode);
  const index = molecule.getIndex();
  const words = [];
  for (let word = 0; word < INDEX_COLUMNS.length; word++) words.push(index[word] >>> 0);
  insert.structure.run(
    compoundId,
    molfile,
    molecule.toIsomericSmiles(),
    round(primary?.mf?.[0]?.mw ?? dumpMf?.mass, 4),
    round(primary?.mf?.[0]?.exactMass ?? dumpMf?.monoisotopicMass, 6),
    ...words,
  );
  stats.structures++;

  for (const name of names) {
    insert.name.run(compoundId, name.value, name.language);
    stats.names++;
  }

  const casSet = new Set();
  for (const record of compound.records) {
    for (const cas of Array.isArray(record.rn) ? record.rn : []) {
      const value = text(String(cas?.value?.value ?? ''));
      if (value) casSet.add(formatCas(value));
    }
  }
  for (const value of casSet) {
    insert.cas.run(compoundId, value);
    stats.cas++;
  }

  // One catalogue entry per listing, merged across the two sources by entry id.
  const listings = new Map();
  for (const dump of compound.dumpEntries) {
    listings.set(dump.entryID, { entryId: dump.entryID, catalogId: dump.catalogID, dump, record: null });
  }
  for (const record of compound.records) {
    const existing = listings.get(record._entryID);
    if (existing) existing.record = record;
    else listings.set(record._entryID, { entryId: record._entryID, catalogId: record.catalogID, dump: null, record });
  }

  const entryIdByEntry = new Map();
  for (const listing of listings.values()) {
    const record = listing.record;
    const catalog = record?.catalog?.[0];
    const rowId = insert.entry.run(
      compoundId,
      listing.entryId,
      String(listing.catalogId ?? record?.catalogID ?? ''),
      text(record?.supplierName) ?? text(record?.owner),
      text(catalog?.description),
      text(catalog?.purity),
    ).lastInsertRowid;
    entryIdByEntry.set(listing.entryId, rowId);
    stats.entries++;

    const meltings = Array.isArray(record?.mp) ? record.mp : listing.dump?.mp ? [listing.dump.mp] : [];
    for (const value of meltings) {
      if (number(value.low) === null && number(value.high) === null) continue;
      insert.mp.run(rowId, number(value.low), number(value.high), text(value.sign));
      stats.mp++;
    }
    const boilings = Array.isArray(record?.bp) ? record.bp : listing.dump?.bp ? [listing.dump.bp] : [];
    for (const value of boilings) {
      if (number(value.low) === null && number(value.high) === null) continue;
      insert.bp.run(rowId, number(value.low), number(value.high), text(value.sign), number(value.pressure));
      stats.bp++;
    }
    const dens = Array.isArray(record?.density) ? record.density : listing.dump?.density ? [listing.dump.density] : [];
    for (const value of dens) {
      if (number(value.low) === null && number(value.high) === null) continue;
      insert.density.run(rowId, number(value.low), number(value.high), number(value.temperature));
      stats.densities++;
    }
    for (const value of Array.isArray(record?.fp) ? record.fp : []) {
      if (number(value.low) === null && number(value.high) === null) continue;
      insert.fp.run(rowId, number(value.low), number(value.high));
      stats.fp++;
    }

    const hazardGroups = [
      ['ghs-hazard', record?.ghsH, (h) => [h.ghs, h.description]],
      ['ghs-precaution', record?.ghsP, (h) => [h.ghs, h.description]],
      ['risk', record?.risk, (h) => [`R${h.value}`, h.description]],
      ['safety', record?.safety, (h) => [`S${h.value}`, h.description]],
      ['symbol', record?.hazard, (h) => [h.value, h.description]],
    ];
    // A few listings carry the same precautionary statement twice; it is one
    // statement, so it is stored once.
    const seenHazards = new Set();
    for (const [system, list, read] of hazardGroups) {
      for (const item of Array.isArray(list) ? list : []) {
        const [code, description] = read(item);
        if (!text(code) && !text(description)) continue;
        const key = `${system}|${text(code) ?? ''}|${text(description) ?? ''}`;
        if (seenHazards.has(key)) continue;
        seenHazards.add(key);
        insert.hazard.run(rowId, system, text(code), text(description));
        stats.hazards++;
      }
    }
    const signal = record?.ghsSW;
    if (signal && text(signal.description)) {
      insert.hazard.run(rowId, 'ghs-signal', text(signal.ghs), text(signal.description));
      stats.hazards++;
    }
  }

  for (const spectrum of irByStructure.get(compound.idCodeNoStereo) ?? []) {
    const jcamp = await readFile(join(RAW, 'jcamp', 'ir', `${spectrum.spectrumId}.jdx`), 'utf8');
    const spectrumId = insert.irSpectrum.run(
      compoundId,
      entryIdByEntry.get(spectrum.entryId) ?? null,
      spectrum.spectrumId,
      text(spectrum.solvent),
      text(spectrum.conditions),
      text(spectrum.meta.xUnits),
      text(spectrum.meta.yUnits),
      jcamp,
    ).lastInsertRowid;
    stats.irSpectra++;
    for (const peak of spectrum.reported.filter((p) => Number.isFinite(p.wavenumber))) {
      insert.irPeak.run(
        spectrumId,
        round(peak.wavenumber, 2),
        round(peak.transmittance, 2),
        null,
        null,
        'reported',
        peak.assignment,
      );
      stats.irPeaks++;
    }
    for (const peak of spectrum.picked.filter((p) => Number.isFinite(p.wavenumber))) {
      insert.irPeak.run(
        spectrumId,
        round(peak.wavenumber, 2),
        round(peak.transmittance, 2),
        round(peak.absorbance, 4),
        round(peak.width, 2),
        'picked',
        null,
      );
      stats.irPeaks++;
    }
  }

  for (const spectrum of nmrByStructure.get(compound.idCodeNoStereo) ?? []) {
    const original = await readFile(join(RAW, 'jcamp', 'nmr', `${spectrum.spectrumId}.jdx`), 'utf8');

    const spectrumId = insert.nmrSpectrum.run(
      compoundId,
      entryIdByEntry.get(spectrum.entryId) ?? null,
      spectrum.spectrumId,
      text(spectrum.meta.nucleus),
      text(spectrum.meta.solvent),
      number(spectrum.meta.frequency),
      text(spectrum.meta.pulseSequence),
      text(spectrum.meta.spectrometer),
      reduceNmrJcamp(original),
    ).lastInsertRowid;
    stats.nmrSpectra++;
    for (const range of spectrum.ranges.filter((r) => Number.isFinite(r.from) && Number.isFinite(r.to))) {
      const rangeId = insert.nmrRange.run(
        spectrumId,
        round(range.from, 4),
        round(range.to, 4),
        round(range.integration, 3),
      ).lastInsertRowid;
      stats.nmrRanges++;
      for (const signal of range.signals ?? []) {
        if (!Number.isFinite(signal.delta)) continue;
        const signalId = insert.nmrSignal.run(
          rangeId,
          round(signal.delta, 4),
          text(signal.multiplicity),
          text(signal.kind),
        ).lastInsertRowid;
        stats.nmrSignals++;
        for (const coupling of (signal.js ?? []).filter((c) => Number.isFinite(c.coupling))) {
          insert.nmrCoupling.run(signalId, round(coupling.coupling, 2), text(coupling.multiplicity));
          stats.nmrCouplings++;
        }
      }
    }
  }
}

db.exec('COMMIT');
const built = new Date().toISOString();

db.exec('VACUUM');
db.exec('ANALYZE');
db.close();

const size = (await stat(OUT)).size;
const gz = gzipSync(await readFile(OUT), { level: 9 }).length;
process.stdout.write(`${JSON.stringify(stats, null, 1)}\n`);
process.stdout.write(
  `\n${OUT}\n  ${(size / 1e6).toFixed(2)} MB on disk, ${(gz / 1e6).toFixed(2)} MB gzipped\n`,
);
await writeFile(join(RAW, 'build-stats.json'), `${JSON.stringify({ ...stats, size, gz, built }, null, 1)}\n`);
