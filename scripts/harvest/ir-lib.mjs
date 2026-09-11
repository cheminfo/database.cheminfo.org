/**
 * Reading an IR JCAMP-DX file, and the options its bands are picked with.
 */
import { convert } from 'jcampconverter';
import { xyEnsureFloat64, xySortX } from 'ml-spectra-processing';

/** Lowest transmittance believed, as a percentage. A fully saturated band. */
const MIN_TRANSMITTANCE = 0.05;

/** Options that best reproduce the suppliers' own band lists — see tune.mjs. */
export const PICKING = {
  minMaxRatio: 0.03,
  broadRatio: 0.0025,
  smoothY: true,
  realTopDetection: true,
  sgOptions: { windowSize: 15, polynomial: 3 },
};

/**
 * Read one IR JCAMP-DX file into wavenumbers and absorbance.
 * @param text - The file contents.
 * @returns The spectrum, or null when the file carries no usable data.
 */
export function readIrSpectrum(text) {
  const converted = convert(text, { keepRecordsRegExp: /.*/ });
  const entry = converted.entries?.[0];
  const spectrum = entry?.spectra?.[0];
  if (!spectrum?.data) return null;
  const { x, y } = spectrum.data;
  const yLabel = String(spectrum.yUnits ?? entry?.info?.YUNITS ?? '');
  // A file may count transmittance in percent or as a 0-1 fraction; the label
  // is what says which, and getting it wrong shifts every absorbance by 2.
  const percent = yLabel.includes('%') || /percent/i.test(yLabel);
  const scale = percent ? 100 : 1;
  const absorbance = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) {
    const transmittance = Math.max((y[i] / scale) * 100, MIN_TRANSMITTANCE);
    absorbance[i] = -Math.log10(transmittance / 100);
  }
  const sorted = xyEnsureFloat64(xySortX({ x, y: absorbance }));
  return {
    x: sorted.x,
    absorbance: sorted.y,
    transmittance: y,
    yLabel,
    percent,
    title: entry?.title ?? '',
    xUnits: String(spectrum.xUnits ?? entry?.info?.XUNITS ?? ''),
  };
}

/**
 * Transmittance at a wavenumber, read back off the measured curve.
 * @param spectrum - The spectrum as read by `readIrSpectrum`.
 * @param wavenumber - Where to read.
 * @returns Percent transmittance at the nearest measured point.
 */
export function transmittanceAt(spectrum, wavenumber) {
  const { x } = spectrum;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < x.length; i++) {
    const delta = Math.abs(x[i] - wavenumber);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return 10 ** -spectrum.absorbance[best] * 100;
}

