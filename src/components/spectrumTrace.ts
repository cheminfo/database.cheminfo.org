/**
 * Turning a spectrum into something a screen can draw.
 *
 * A proton spectrum is 32,768 points and a chart is about a thousand pixels
 * wide, so the trace is reduced to one column per pixel keeping that column's
 * lowest and highest value. Averaging would flatten a sharp line into nothing;
 * a min/max envelope keeps every peak at its real height.
 */

export interface Trace {
  /** x of each column, in the units the file declares. */
  x: Float64Array;
  /** Lowest y seen in the column. */
  low: Float64Array;
  /** Highest y seen in the column. */
  high: Float64Array;
  /** The extremes over the whole trace. */
  yMin: number;
  yMax: number;
  xMin: number;
  xMax: number;
}

/**
 * Reduce a spectrum to at most `columns` min/max pairs.
 * @param x - The measured x values, ascending or descending.
 * @param y - The measured y values.
 * @param columns - How many columns the chart has room for.
 * @returns The envelope, with x ascending.
 */
export function buildTrace(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  columns: number,
): Trace {
  const length = Math.min(x.length, y.length);
  if (length === 0) {
    const empty = new Float64Array(0);
    return {
      x: empty,
      low: empty,
      high: empty,
      yMin: 0,
      yMax: 1,
      xMin: 0,
      xMax: 1,
    };
  }

  const first = x[0] ?? 0;
  const last = x[length - 1] ?? 0;
  // A Bruker axis runs downwards; everything below assumes it climbs.
  const descending = last < first;
  const width = Math.max(1, Math.min(columns, length));
  const xs = new Float64Array(width);
  const low = new Float64Array(width);
  const high = new Float64Array(width);

  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  for (let column = 0; column < width; column++) {
    const start = Math.floor((column * length) / width);
    const end = Math.max(
      start + 1,
      Math.floor(((column + 1) * length) / width),
    );
    let columnLow = Number.POSITIVE_INFINITY;
    let columnHigh = Number.NEGATIVE_INFINITY;
    for (let i = start; i < end; i++) {
      const value = y[i];
      if (value === undefined) continue;
      if (value < columnLow) columnLow = value;
      if (value > columnHigh) columnHigh = value;
    }
    const index = descending ? width - 1 - column : column;
    xs[index] = x[Math.floor((start + end) / 2)] ?? 0;
    low[index] = columnLow;
    high[index] = columnHigh;
    if (columnLow < yMin) yMin = columnLow;
    if (columnHigh > yMax) yMax = columnHigh;
  }

  return {
    x: xs,
    low,
    high,
    yMin,
    yMax,
    xMin: Math.min(first, last),
    xMax: Math.max(first, last),
  };
}

/**
 * The path of the trace, as an SVG `d` attribute.
 * @param trace - The envelope.
 * @param plot - Where to draw it.
 * @param plot.width - Pixel width of the plot area.
 * @param plot.height - Pixel height of the plot area.
 * @param plot.reversed - Whether x runs right to left, as IR and NMR both do.
 * @param plot.yFrom - The y value at the bottom of the plot.
 * @param plot.yTo - The y value at the top.
 * @returns The path.
 */
export function tracePath(
  trace: Trace,
  plot: {
    width: number;
    height: number;
    reversed: boolean;
    yFrom: number;
    yTo: number;
  },
): string {
  const { width, height, reversed, yFrom, yTo } = plot;
  const span = trace.xMax - trace.xMin || 1;
  const range = yTo - yFrom || 1;
  const toX = (value: number): number => {
    const fraction = (value - trace.xMin) / span;
    return (reversed ? 1 - fraction : fraction) * width;
  };
  const toY = (value: number): number =>
    height - ((value - yFrom) / range) * height;

  // One continuous path, alternating low and high per column. Separate vertical
  // strokes would be invisible wherever a column holds a single sample — an IR
  // file has fewer points than the chart has columns — because a zero-length
  // segment paints nothing.
  const parts: string[] = [];
  for (let i = 0; i < trace.x.length; i++) {
    const at = trace.x[i] ?? Number.NaN;
    const low = trace.low[i] ?? Number.NaN;
    const high = trace.high[i] ?? Number.NaN;
    // A spectrum carrying a NaN would otherwise emit a path the browser drops
    // in its entirety, losing every other column with it.
    if (!Number.isFinite(at + low + high)) continue;
    const px = toX(at).toFixed(2);
    parts.push(
      `${parts.length === 0 ? 'M' : 'L'}${px} ${toY(low).toFixed(2)}L${px} ${toY(high).toFixed(2)}`,
    );
  }
  return parts.join('');
}
