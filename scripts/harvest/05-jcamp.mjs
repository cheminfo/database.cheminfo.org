/**
 * Download the JCAMP-DX file behind every spectrum the database will carry.
 * Files are cached on disk, so a re-run costs nothing.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { DELAY_MS, getText, jcampUrl, readJson, sleep } from './lib.mjs';

const RAW = join(import.meta.dirname, '../../data/raw');
const OUT = join(RAW, 'jcamp');

await mkdir(join(OUT, 'ir'), { recursive: true });
await mkdir(join(OUT, 'nmr'), { recursive: true });

const compounds = await readJson(join(RAW, 'compounds.json'));

const jobs = [];
for (const compound of compounds) {
  for (const record of compound.records) {
    for (const spectrum of record.ir ?? []) {
      const id = spectrum.jcamp?.filename?.match(/(\d+)\.jdx$/)?.[1];
      if (id) jobs.push({ table: 'ir', id, entryId: record._entryID });
    }
    for (const spectrum of record.nmr ?? []) {
      const id = spectrum.jcamp?.filename?.match(/(\d+)\.jdx$/)?.[1];
      if (id) jobs.push({ table: 'nmr', id, entryId: record._entryID });
    }
  }
}

process.stdout.write(
  `${jobs.length} spectra — ir ${jobs.filter((j) => j.table === 'ir').length}, nmr ${jobs.filter((j) => j.table === 'nmr').length}\n`,
);

const have = {
  ir: new Set(await readdir(join(OUT, 'ir')).catch(() => [])),
  nmr: new Set(await readdir(join(OUT, 'nmr')).catch(() => [])),
};

let downloaded = 0;
let failed = 0;
const bytes = { ir: 0, nmr: 0 };
for (const [position, job] of jobs.entries()) {
  const file = `${job.id}.jdx`;
  const path = join(OUT, job.table, file);
  if (have[job.table].has(file)) continue;
  const text = await getText(jcampUrl(job.table, job.id));
  await sleep(DELAY_MS);
  if (!text || !text.includes('##END')) {
    failed++;
    continue;
  }
  await writeFile(path, text);
  bytes[job.table] += text.length;
  downloaded++;
  if (position % 10 === 0) {
    process.stdout.write(`\r  ${position + 1}/${jobs.length} — ${downloaded} new, ${failed} failed   `);
  }
}
process.stdout.write(`\r  ${jobs.length}/${jobs.length} — ${downloaded} new, ${failed} failed\n`);

for (const table of ['ir', 'nmr']) {
  const files = await readdir(join(OUT, table));
  const sizes = await Promise.all(
    files.map(async (f) => (await import('node:fs/promises')).stat(join(OUT, table, f)).then((s) => s.size)),
  );
  const total = sizes.reduce((a, b) => a + b, 0);
  sizes.sort((a, b) => a - b);
  process.stdout.write(
    `${table}: ${files.length} files, total ${(total / 1e6).toFixed(1)} MB, median ${(sizes[sizes.length >> 1] / 1024).toFixed(0)} kB, max ${(sizes.at(-1) / 1024).toFixed(0)} kB\n`,
  );
}
