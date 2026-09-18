import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/**
 * The site as a deployment stamped it, loaded fresh so its mount is read again.
 * @param baseUri - What `document.baseURI` reads on the page handed out.
 * @returns The module, bound to that mount.
 */
async function siteMountedAt(baseUri: string) {
  vi.stubGlobal('document', { baseURI: baseUri });
  vi.resetModules();
  return import('../site.ts');
}

test('a deployment on a host of its own writes its addresses unchanged', async () => {
  const site = await siteMountedAt('https://database.cheminfo.org/');

  expect(site.BASE_PATH).toBe('');
  expect(site.withBase('/')).toBe('/');
  expect(site.withBase('/tutorial')).toBe('/tutorial');
  expect(site.pathWithoutBase('/tutorial')).toBe('/tutorial');
});

test('a deployment mounted under a path writes every address under it', async () => {
  const site = await siteMountedAt('https://eln.epfl.ch/cheminfo/database/');

  expect(site.BASE_PATH).toBe('/cheminfo/database');
  expect(site.withBase('/')).toBe('/cheminfo/database/');
  expect(site.withBase('/tutorial')).toBe('/cheminfo/database/tutorial');
  expect(site.pathWithoutBase('/cheminfo/database/tutorial')).toBe('/tutorial');
  expect(site.pathWithoutBase('/cheminfo/database')).toBe('/');
});

test('the same build serves both addresses, because the mount is not built in', async () => {
  const own = await siteMountedAt('https://database.cheminfo.org/');
  const shared = await siteMountedAt('https://eln.epfl.ch/cheminfo/database/');

  expect(own.withBase('/about')).toBe('/about');
  expect(shared.withBase('/about')).toBe('/cheminfo/database/about');
});

test('a page of another tool on the shared host is not read as one of ours', async () => {
  const site = await siteMountedAt('https://eln.epfl.ch/cheminfo/database/');

  expect(site.pathWithoutBase('/cheminfo/surge/exercises')).toBe(
    '/cheminfo/surge/exercises',
  );
  expect(site.pathWithoutBase('/cheminfo/databasex')).toBe(
    '/cheminfo/databasex',
  );
});

test('a link to a section stays on the page on screen, query included', async () => {
  const site = await siteMountedAt('https://eln.epfl.ch/cheminfo/database/');
  vi.stubGlobal('location', {
    pathname: '/cheminfo/database/schema',
    search: '?embed',
  });

  expect(site.sectionHref('table-compounds')).toBe(
    '/cheminfo/database/schema?embed#table-compounds',
  );
});
