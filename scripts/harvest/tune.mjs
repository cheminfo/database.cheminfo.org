/**
 * Choose the IR peak-picking options by scoring them against the band lists
 * the suppliers published for the same spectra.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { gsd } from 'ml-gsd';

import { PICKING, readIrSpectrum } from './ir-lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
/** A band matched within this many cm-1 counts as the same band. */
const TOLERANCE = 15;

const picked = JSON.parse(await readFile(join(RAW, 'ir-picked.json'), 'utf8'));
const sample = picked.filter((r) => r.reported.length >= 8).slice(0, 45);

const spectra = new Map();
for (const record of sample) {
  const text = await readFile(join(RAW, 'jcamp', 'ir', `${record.spectrumId}.jdx`), 'utf8');
  spectra.set(record.spectrumId, readIrSpectrum(text));
}

function score(peaks, reported) {
  const used = new Set();
  let hit = 0;
  for (const target of reported) {
    let best = -1;
    let bestDelta = TOLERANCE;
    for (const [i, peak] of peaks.entries()) {
      if (used.has(i)) continue;
      const delta = Math.abs(peak.x - target.wavenumber);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      hit++;
    }
  }
  const recall = hit / reported.length;
  const precision = peaks.length ? hit / peaks.length : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { recall, precision, f1, n: peaks.length };
}

const grid = [];
for (const minMaxRatio of [0.03, 0.06, 0.1, 0.15]) {
  for (const broadRatio of [0.0025, 0.01, 0.05]) {
    for (const windowSize of [5, 9, 15, 25, 41]) {
      grid.push({
        minMaxRatio,
        broadRatio,
        smoothY: true,
        realTopDetection: true,
        sgOptions: { windowSize, polynomial: 3 },
      });
    }
  }
}

const rows = [];
for (const options of grid) {
  let recall = 0;
  let precision = 0;
  let f1 = 0;
  let count = 0;
  for (const record of sample) {
    const spectrum = spectra.get(record.spectrumId);
    try {
      const peaks = gsd({ x: spectrum.x, y: spectrum.absorbance }, options);
      const s = score(peaks, record.reported);
      recall += s.recall;
      precision += s.precision;
      f1 += s.f1;
      count += s.n;
    } catch {
      // A setting the picker rejects simply scores nothing.
    }
  }
  const n = sample.length;
  rows.push({ options, recall: recall / n, precision: precision / n, f1: f1 / n, peaks: count / n });
}

rows.sort((a, b) => b.f1 - a.f1);
process.stdout.write('minMax  broad   window  recall  prec    f1      peaks\n');
for (const row of rows.slice(0, 12)) {
  const o = row.options;
  process.stdout.write(
    `${String(o.minMaxRatio).padEnd(7)} ${String(o.broadRatio).padEnd(7)} ${String(o.sgOptions.windowSize).padEnd(7)} ${row.recall.toFixed(3)}   ${row.precision.toFixed(3)}   ${row.f1.toFixed(3)}   ${row.peaks.toFixed(1)}\n`,
  );
}
