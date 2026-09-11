/**
 * Reduce each Bruker NMR export to its spectrum, then pick its ranges.
 *
 * The exported file carries a 1200-line instrument parameter dump, an audit
 * trail and a second page holding the imaginary channel. None of that is the
 * measurement, and together they are 60 % of the bytes, so the stored JCAMP-DX
 * keeps the header, the NTUPLES declaration and the real page — every point
 * that was measured, and nothing else.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { convert } from 'jcampconverter';
import { xyEnsureFloat64, xySortX } from 'ml-spectra-processing';
import { xyAutoRangesPicking } from 'nmr-processing';

import { readJson, writeJson } from './lib.mjs';
import { reduceNmrJcamp } from './nmr-lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');

/** How many spectra ship with their JCAMP-DX. */
const WANTED = 50;

/** The window a 1H spectrum is picked over; outside it there is only noise. */
const FROM_PPM = -0.5;
const TO_PPM = 12;

function metadata(converted) {
  const spectrum = converted.entries[0]?.spectra?.[0] ?? {};
  const info = converted.entries[0]?.info ?? {};
  const nucleus = String(info['.OBSERVENUCLEUS'] ?? info['.OBSERVE NUCLEUS'] ?? '^1H').replace('^', '');
  return {
    nucleus,
    solvent: String(info['.SOLVENTNAME'] ?? info['.SOLVENT NAME'] ?? '').trim(),
    pulseSequence: String(info['.PULSESEQUENCE'] ?? info['.PULSE SEQUENCE'] ?? '').trim(),
    spectrometer: String(info['SPECTROMETER/DATASYSTEM'] ?? info['SPECTROMETER/DATA SYSTEM'] ?? '').trim(),
    frequency: spectrum.observeFrequency ?? null,
    data: spectrum.data ?? null,
  };
}

/**
 * Count the hydrogens a molecular formula declares.
 * @param formula - A formula written as `C6 H10 N2` or `C6H10N2`.
 * @returns The hydrogen count, or null when the formula has none.
 */
function hydrogenCount(formula) {
  const match = /H(\d*)(?![a-z])/.exec(formula.replaceAll(' ', ''));
  if (!match) return null;
  return match[1] === '' ? 1 : Number(match[1]);
}

const compounds = await readJson(join(RAW, 'compounds.json'));
const available = await readdir(join(RAW, 'jcamp', 'nmr'));
const haveFile = new Set(available);

const jobs = [];
for (const compound of compounds) {
  for (const record of compound.records) {
    for (const spectrum of record.nmr ?? []) {
      const id = spectrum.jcamp?.filename?.match(/(\d+)\.jdx$/)?.[1];
      if (!id || !haveFile.has(`${id}.jdx`)) continue;
      jobs.push({
        spectrumId: id,
        entryId: record._entryID,
        idCodeNoStereo: compound.idCodeNoStereo,
        formula: record.mf?.[0]?.value?.value ?? '',
        name: record.iupac?.find((n) => n.language === 'en')?.value ?? record.iupac?.[0]?.value ?? '',
        declared: spectrum,
      });
    }
  }
}
process.stdout.write(`${jobs.length} NMR spectra to process\n`);

const results = [];
for (const job of jobs) {
  const original = await readFile(join(RAW, 'jcamp', 'nmr', `${job.spectrumId}.jdx`), 'utf8');
  const reduced = reduceNmrJcamp(original);
  let converted;
  try {
    converted = convert(reduced, { keepRecordsRegExp: /.*/ });
  } catch (error) {
    process.stderr.write(`  ! ${job.spectrumId} reduce/parse: ${String(error)}\n`);
    continue;
  }
  const meta = metadata(converted);
  if (!meta.data || !meta.frequency) {
    process.stderr.write(`  ! ${job.spectrumId} no data or frequency\n`);
    continue;
  }
  // GSD needs x increasing; the Bruker axis runs the other way.
  const data = xyEnsureFloat64(xySortX(meta.data));
  const protons = hydrogenCount(job.formula) ?? 100;
  let ranges;
  try {
    ranges = xyAutoRangesPicking(data, {
      peakPicking: { frequency: meta.frequency, from: FROM_PPM, to: TO_PPM, thresholdFactor: 3 },
      identifyImpurities: true,
      impurities: { solvent: meta.solvent },
      ranges: {
        nucleus: meta.nucleus,
        frequency: meta.frequency,
        integrationSum: protons,
        clean: 0.4,
        keepPeaks: true,
      },
    });
  } catch (error) {
    process.stderr.write(`  ! ${job.spectrumId} picking: ${String(error)}\n`);
    continue;
  }
  results.push({
    ...job,
    reducedBytes: reduced.length,
    originalBytes: original.length,
    meta: {
      nucleus: meta.nucleus,
      solvent: meta.solvent,
      pulseSequence: meta.pulseSequence,
      spectrometer: meta.spectrometer,
      frequency: meta.frequency,
      nbPoints: data.x.length,
      firstX: data.x[0],
      lastX: data.x.at(-1),
    },
    protons,
    ranges,
  });
  process.stdout.write(
    `\r  ${results.length}/${jobs.length} — ${job.name.slice(0, 34).padEnd(34)} ${String(ranges.length).padStart(2)} ranges  ${(reduced.length / 1024).toFixed(0)}kB (was ${(original.length / 1024).toFixed(0)}kB)   `,
  );
}
process.stdout.write('\n');

const usable = results.filter((r) => r.ranges.length >= 2);
usable.sort((a, b) => b.ranges.length - a.ranges.length);

// Spread the shipped set over range counts rather than taking the busiest.
const spread = [];
const seenStructures = new Set();
for (const result of usable) {
  if (seenStructures.has(result.idCodeNoStereo)) continue;
  seenStructures.add(result.idCodeNoStereo);
  spread.push(result);
}
const shipped = spread.slice(0, WANTED);

const totals = {
  processed: results.length,
  usable: usable.length,
  shipped: shipped.length,
  ranges: shipped.reduce((sum, r) => sum + r.ranges.length, 0),
  signals: shipped.reduce((sum, r) => sum + r.ranges.reduce((s, g) => s + (g.signals?.length ?? 0), 0), 0),
  couplings: shipped.reduce(
    (sum, r) =>
      sum + r.ranges.reduce((s, g) => s + (g.signals ?? []).reduce((t, sig) => t + (sig.js?.length ?? 0), 0), 0),
    0,
  ),
  jcampBytes: shipped.reduce((sum, r) => sum + r.reducedBytes, 0),
};
process.stdout.write(`${JSON.stringify(totals, null, 1)}\n`);

await writeJson(join(RAW, 'nmr-picked.json'), shipped.map((r) => ({ ...r, declared: undefined })));
