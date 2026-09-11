/**
 * Peak-pick every IR spectrum, and keep the supplier's own band list beside it.
 *
 * A band is a maximum in absorbance and a minimum in transmittance, so picking
 * runs on absorbance. Transmittance reaches exactly zero in saturated bands of
 * these files, and -log10(0) is Infinity, which silently returns no peaks at
 * all — so it is clamped to a floor first.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { gsd } from 'ml-gsd';

import { PICKING, readIrSpectrum, transmittanceAt } from './ir-lib.mjs';
import { readJson, writeJson } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');

const compounds = await readJson(join(RAW, 'compounds.json'));
const haveFile = new Set(await readdir(join(RAW, 'jcamp', 'ir')));

const jobs = [];
for (const compound of compounds) {
  for (const record of compound.records) {
    for (const spectrum of record.ir ?? []) {
      const id = spectrum.jcamp?.filename?.match(/(\d+)\.jdx$/)?.[1];
      if (!id || !haveFile.has(`${id}.jdx`)) continue;
      jobs.push({
        spectrumId: id,
        entryId: record._entryID,
        idCodeNoStereo: compound.idCodeNoStereo,
        name: record.iupac?.find((n) => n.language === 'en')?.value ?? record.iupac?.[0]?.value ?? '',
        solvent: spectrum.solvent ?? '',
        conditions: spectrum.conditions ?? '',
        reported: (spectrum.irLine ?? [])
          .filter((line) => typeof line.value === 'number')
          .map((line) => ({
            wavenumber: line.value,
            transmittance: typeof line.percent === 'number' ? line.percent : null,
            assignment: line.assignment || null,
            kind: line.type || null,
          })),
      });
    }
  }
}
process.stdout.write(`${jobs.length} IR spectra to process\n`);

const results = [];
let failed = 0;
for (const job of jobs) {
  const text = await readFile(join(RAW, 'jcamp', 'ir', `${job.spectrumId}.jdx`), 'utf8');
  let spectrum;
  let peaks;
  try {
    spectrum = readIrSpectrum(text);
    if (!spectrum) throw new Error('no data block');
    peaks = gsd({ x: spectrum.x, y: spectrum.absorbance }, PICKING);
  } catch (error) {
    failed++;
    process.stderr.write(`  ! ${job.spectrumId} ${job.name}: ${String(error).slice(0, 110)}\n`);
    continue;
  }
  results.push({
    ...job,
    meta: {
      xUnits: spectrum.xUnits,
      yUnits: spectrum.yLabel,
      nbPoints: spectrum.x.length,
      firstX: spectrum.x[0],
      lastX: spectrum.x.at(-1),
      title: spectrum.title,
    },
    bytes: text.length,
    picked: peaks.map((peak) => ({
      wavenumber: peak.x,
      absorbance: peak.y,
      transmittance: transmittanceAt(spectrum, peak.x),
      width: peak.width ?? null,
    })),
  });
  if (results.length % 25 === 0) {
    process.stdout.write(`\r  ${results.length}/${jobs.length} processed, ${failed} failed   `);
  }
}
process.stdout.write(`\r  ${results.length}/${jobs.length} processed, ${failed} failed\n`);

const counts = results.map((r) => r.picked.length).sort((a, b) => a - b);
process.stdout.write(
  `${JSON.stringify(
    {
      spectra: results.length,
      reportedPeaks: results.reduce((s, r) => s + r.reported.length, 0),
      pickedPeaks: results.reduce((s, r) => s + r.picked.length, 0),
      medianPicked: counts[counts.length >> 1],
      jcampBytes: results.reduce((s, r) => s + r.bytes, 0),
    },
    null,
    1,
  )}\n`,
);

const ethanol = results.find((r) => r.name === 'Ethanol') ?? results[0];
process.stdout.write(`example — ${ethanol.name}\n`);
process.stdout.write(`  picked   ${ethanol.picked.map((p) => p.wavenumber.toFixed(0)).join(' ')}\n`);
process.stdout.write(`  reported ${ethanol.reported.map((p) => p.wavenumber.toFixed(0)).join(' ')}\n`);

await writeJson(join(RAW, 'ir-picked.json'), results);
