import { expect, test, vi } from 'vitest';

/**
 * The dev server's own settings, read from the real `vite.config.ts`.
 *
 * `open` decides where `npm run dev` puts the window, and Playwright has to be
 * able to turn it off — a test run starts the same server on every worker and
 * must not throw a browser window up each time.
 * @param env - Environment variables the config is resolved under.
 * @returns The resolved `server` block.
 */
async function resolveServer(env: Record<string, string> = {}): Promise<{
  port?: number;
  strictPort?: boolean;
  open?: boolean | string;
}> {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  try {
    vi.resetModules();
    const module = await import('../../vite.config.ts');
    return module.default.server ?? {};
  } finally {
    vi.unstubAllEnvs();
  }
}

test('npm run dev opens the data browser', async () => {
  const server = await resolveServer();
  expect(server.open).toBe('/browse');
});

test('a test run can turn that off', async () => {
  const server = await resolveServer({ DEV_NO_OPEN: '1' });
  expect(server.open).toBe(false);
});

test('the dev server holds the port this project owns', async () => {
  const server = await resolveServer();
  expect(server.port).toBe(10_824);
  expect(server.strictPort).toBe(true);
});
