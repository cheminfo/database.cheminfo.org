import { expect, test } from 'vitest';

import { buildTrace, tracePath } from '../spectrumTrace.ts';

/** Where the drawn path starts, so a mirrored axis can be told from a plain one. */
function firstX(path: string): number {
  return Number(/^M(?<x>[\d.]+)/.exec(path)?.groups?.x ?? Number.NaN);
}

test('an ascending spectrum keeps its extremes', () => {
  const trace = buildTrace(
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 5, 1, 9, 2, 3, 0, 4],
    4,
  );
  expect(trace.x).toHaveLength(4);
  expect(trace.yMin).toBe(0);
  expect(trace.yMax).toBe(9);
  expect(trace.xMin).toBe(0);
  expect(trace.xMax).toBe(7);
});

test('a sharp peak survives the reduction, where averaging would lose it', () => {
  const x = Array.from({ length: 1000 }, (_, i) => i);
  const y = Array.from({ length: 1000 }, (_, i) => (i === 500 ? 100 : 0));
  const trace = buildTrace(x, y, 50);
  expect(trace.yMax).toBe(100);
  let columnsHoldingIt = 0;
  for (const value of trace.high) if (value === 100) columnsHoldingIt++;
  expect(columnsHoldingIt).toBe(1);
});

test('a descending axis comes back ascending', () => {
  const trace = buildTrace([10, 9, 8, 7, 6, 5], [1, 2, 3, 4, 5, 6], 3);
  expect(Number(trace.x[0])).toBeLessThan(Number(trace.x[2]));
  expect(trace.xMin).toBe(5);
  expect(trace.xMax).toBe(10);
});

test('an empty spectrum does not divide by zero', () => {
  const trace = buildTrace([], [], 10);
  expect(trace.x).toHaveLength(0);
  expect(() =>
    tracePath(trace, {
      width: 100,
      height: 50,
      reversed: true,
      yFrom: 0,
      yTo: 1,
    }),
  ).not.toThrow();
});

test('the path spans the plot, and a reversed axis mirrors it', () => {
  const trace = buildTrace([0, 1, 2, 3], [0, 1, 0, 1], 4);
  const plot = { width: 100, height: 50, yFrom: 0, yTo: 1 };
  const forward = tracePath(trace, { ...plot, reversed: false });
  const reversed = tracePath(trace, { ...plot, reversed: true });
  expect(forward).not.toBe(reversed);
  expect(firstX(forward)).toBeCloseTo(0, 1);
  expect(firstX(reversed)).toBeCloseTo(100, 1);
});

test('the trace is one connected path, so no column can vanish', () => {
  const trace = buildTrace([0, 1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], 6);
  const path = tracePath(trace, {
    width: 60,
    height: 30,
    reversed: false,
    yFrom: 0,
    yTo: 6,
  });
  // One move, then two points per column: no segment is ever zero-length,
  // which is what made a single-sample column paint nothing at all.
  expect(path.match(/M/g)).toHaveLength(1);
  expect(path.match(/L/g)).toHaveLength(11);
});

test('a spectrum with one sample per column still draws', () => {
  // 934 points into 1000 columns, as an IR file gives: every column holds a
  // single sample, so its low equals its high.
  const x = Array.from({ length: 934 }, (_, i) => 400 + i * 4);
  const y = Array.from({ length: 934 }, (_, i) => Math.sin(i / 20) * 10 + 50);
  const trace = buildTrace(x, y, 1000);
  const path = tracePath(trace, {
    width: 1000,
    height: 176,
    reversed: true,
    yFrom: 39,
    yTo: 61,
  });
  expect(path.length).toBeGreaterThan(1000);
  const ys = [...path.matchAll(/[ML][\d.]+ (?<y>[\d.]+)/g)].map((match) =>
    Number(match.groups?.y),
  );
  // The path moves up and down rather than sitting flat on one line.
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(50);
});
