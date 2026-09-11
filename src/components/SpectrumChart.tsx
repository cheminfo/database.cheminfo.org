import { Callout, Spinner } from '@blueprintjs/core';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { Trace } from './spectrumTrace.ts';
import { buildTrace, tracePath } from './spectrumTrace.ts';

/** A line drawn on the spectrum, where a peak or a signal was found. */
export interface SpectrumMarker {
  /** Where it sits, in the spectrum's own x units. */
  x: number;
  /** What to write above it. */
  label?: string;
  /** Which set it belongs to, so the legend and the colour agree. */
  kind: string;
}

/** A shaded band, as an integrated NMR range is. */
export interface SpectrumBand {
  from: number;
  to: number;
  label?: string;
}

export interface SpectrumChartProps {
  /** The JCAMP-DX as the database stores it. */
  jcamp: string;
  /** Peaks or signals to mark. */
  markers?: SpectrumMarker[];
  /** Ranges to shade. */
  bands?: SpectrumBand[];
  /** What each marker kind is called, and the colour it takes. */
  legend?: Array<{ kind: string; label: string; color: string }>;
  /** Height of the plot area in pixels. */
  height?: number;
  /**
   * The window to draw, in the spectrum's own x units. A proton spectrum is
   * acquired over twenty ppm and carries signal in eight of them, so the
   * useful part would otherwise be a smear against the axis. Pass a stable
   * object — a module constant — so the trace is not rebuilt every render.
   * @default the whole spectrum
   */
  window?: { from: number; to: number };
}

const PLOT_WIDTH = 1000;
const MARGIN = { top: 18, right: 12, bottom: 26, left: 12 };

/** One parse, remembered together with the file it was made from. */
interface ParseResult {
  jcamp: string;
  parsed?: ParsedSpectrum;
  failure?: string;
}

interface ParsedSpectrum {
  x: Float64Array | number[];
  y: Float64Array | number[];
  xUnits: string;
  yUnits: string;
}

/**
 * Draw a spectrum from the JCAMP-DX the database carries.
 *
 * The parser is loaded on demand: it is only needed by someone who opens a
 * spectrum, and it should not sit in the bundle every visitor downloads. Both
 * axes run right to left, which is how a chemist reads a wavenumber and a
 * chemical shift.
 * @param props - The spectrum and what to mark on it.
 * @returns The chart.
 */
export function SpectrumChart(props: SpectrumChartProps): ReactElement {
  const {
    jcamp,
    markers = [],
    bands = [],
    legend = [],
    height = 220,
    window: view,
  } = props;
  // The result carries the file it came from, so a changed `jcamp` shows the
  // spinner again by comparison during render rather than by resetting state.
  const [result, setResult] = useState<ParseResult | null>(null);
  const current = result?.jcamp === jcamp ? result : null;
  const parsed = current?.parsed ?? null;
  const failure = current?.failure ?? null;

  useEffect(() => {
    let cancelled = false;
    import('jcampconverter')
      .then(({ convert }) => {
        if (cancelled) return;
        const converted = convert(jcamp, { keepRecordsRegExp: /.*/ });
        const spectrum = converted.entries?.[0]?.spectra?.[0];
        const x = spectrum?.data?.x;
        const y = spectrum?.data?.y;
        if (!x || !y) throw new Error('the file carries no data table');
        setResult({
          jcamp,
          parsed: {
            x,
            y,
            xUnits: String(spectrum?.xUnits ?? ''),
            yUnits: String(spectrum?.yUnits ?? ''),
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          jcamp,
          failure: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [jcamp]);

  const trace: Trace | null = useMemo(() => {
    if (!parsed) return null;
    const cropped = view
      ? crop(parsed.x, parsed.y, view.from, view.to)
      : parsed;
    return buildTrace(cropped.x, cropped.y, PLOT_WIDTH);
  }, [parsed, view]);

  if (failure) {
    return (
      <Callout intent="danger">
        This spectrum could not be drawn: {failure}
      </Callout>
    );
  }
  if (!trace || !parsed) {
    return (
      <div className="spectrum spectrum--loading" style={{ height }}>
        <Spinner size={24} />
      </div>
    );
  }

  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const pad = (trace.yMax - trace.yMin) * 0.06 || 1;
  const yFrom = trace.yMin - pad;
  const yTo = trace.yMax + pad;
  const span = trace.xMax - trace.xMin || 1;
  // Both a wavenumber and a chemical shift are read right to left.
  const toX = (value: number): number =>
    MARGIN.left + (1 - (value - trace.xMin) / span) * PLOT_WIDTH;

  const colorOf = (kind: string): string =>
    legend.find((item) => item.kind === kind)?.color ?? 'var(--accent)';

  const ticks = axisTicks(trace.xMin, trace.xMax);

  return (
    <figure className="spectrum">
      <svg
        viewBox={`0 0 ${PLOT_WIDTH + MARGIN.left + MARGIN.right} ${height}`}
        className="spectrum__svg"
        style={{ height }}
        role="img"
        aria-label={`Spectrum, ${parsed.xUnits} against ${parsed.yUnits}`}
        preserveAspectRatio="none"
      >
        {bands.map((band) => {
          const left = Math.min(toX(band.from), toX(band.to));
          const width = Math.abs(toX(band.from) - toX(band.to));
          return (
            <rect
              key={`${band.from}-${band.to}`}
              x={left}
              y={MARGIN.top}
              width={Math.max(width, 1.5)}
              height={plotHeight}
              className="spectrum__band"
            />
          );
        })}

        {markers.map((marker) => (
          <line
            key={`${marker.kind}-${marker.x}`}
            x1={toX(marker.x)}
            x2={toX(marker.x)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotHeight}
            stroke={colorOf(marker.kind)}
            className="spectrum__marker"
          />
        ))}

        <path
          d={tracePath(trace, {
            width: PLOT_WIDTH,
            height: plotHeight,
            reversed: true,
            yFrom,
            yTo,
          })}
          transform={`translate(${MARGIN.left} ${MARGIN.top})`}
          className="spectrum__trace"
        />

        <line
          x1={MARGIN.left}
          x2={MARGIN.left + PLOT_WIDTH}
          y1={MARGIN.top + plotHeight}
          y2={MARGIN.top + plotHeight}
          className="spectrum__axis"
        />
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={toX(tick)}
              x2={toX(tick)}
              y1={MARGIN.top + plotHeight}
              y2={MARGIN.top + plotHeight + 4}
              className="spectrum__axis"
            />
            <text x={toX(tick)} y={height - 8} className="spectrum__tick">
              {formatTick(tick)}
            </text>
          </g>
        ))}
      </svg>

      <figcaption className="spectrum__caption">
        <span>
          {parsed.xUnits} · {trace.x.length.toLocaleString('en')} columns from{' '}
          {parsed.x.length.toLocaleString('en')} points
        </span>
        {legend.map((item) => (
          <span key={item.kind} className="spectrum__key">
            <span
              className="spectrum__swatch"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/**
 * Keep only the points inside a window.
 * @param x - The measured x values, in either direction.
 * @param y - The measured y values.
 * @param from - One edge of the window.
 * @param to - The other edge.
 * @returns The points between them; the whole spectrum when none are.
 */
function crop(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  from: number,
  to: number,
): { x: number[]; y: number[] } {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const keptX: number[] = [];
  const keptY: number[] = [];
  const length = Math.min(x.length, y.length);
  for (let i = 0; i < length; i++) {
    const at = x[i];
    const value = y[i];
    if (at === undefined || value === undefined) continue;
    if (at < low || at > high) continue;
    keptX.push(at);
    keptY.push(value);
  }
  if (keptX.length === 0) {
    return { x: [...(x as number[])], y: [...(y as number[])] };
  }
  return { x: keptX, y: keptY };
}

/** Round tick positions that land on numbers a reader expects. */
function axisTicks(min: number, max: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const rough = span / 8;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((s) => s >= rough) ??
    rough;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(1);
}
