import { afterEach, expect, test, vi } from 'vitest';

import { loadDatabase, resetDatabase } from '../loadDatabase.ts';

afterEach(() => {
  resetDatabase();
  vi.unstubAllGlobals();
});

function respondWith(body: Uint8Array, headers: Record<string, string> = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(body as unknown as BodyInit, {
          status: 200,
          headers: { 'content-length': String(body.byteLength), ...headers },
        }),
    ),
  );
}

test('the fallback page is reported as a missing file, not opened as a database', async () => {
  respondWith(new TextEncoder().encode('<!doctype html><html><body>hello'));
  await expect(loadDatabase({ url: '/chem.sqlite' })).rejects.toThrow(
    /answered with a web page rather than the database/,
  );
});

test('anything else that is not a database says what it found instead', async () => {
  respondWith(new TextEncoder().encode('not a database at all, just some text here'));
  await expect(loadDatabase({ url: '/chem.sqlite' })).rejects.toThrow(/is not a SQLite database/);
});

test('a failed request says so', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 404 })),
  );
  await expect(loadDatabase({ url: '/chem.sqlite' })).rejects.toThrow(/HTTP 404/);
});

test('progress is reported while the body arrives', async () => {
  const header = new TextEncoder().encode('SQLite format 3\0');
  respondWith(header);
  const seen: number[] = [];
  // It still fails to open — the header alone is not a database — but the
  // bytes are read and reported before that.
  await loadDatabase({
    url: '/chem.sqlite',
    onProgress: ({ received }) => seen.push(received),
  }).catch(() => undefined);
  expect(seen.at(-1)).toBe(header.byteLength);
});
