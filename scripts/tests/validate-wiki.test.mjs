import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateWiki } from '../validate-wiki.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nexodocs-wiki-test-'));
  t.after(async () => {
    const relative = path.relative(os.tmpdir(), root);
    if (path.isAbsolute(relative) || relative.startsWith('..') || !relative.startsWith('nexodocs-wiki-test-'))
      throw new Error('Directorio temporal inesperado');
    await rm(root, { recursive: true, force: true });
  });
  const wiki = path.join(root, 'docs', 'wiki');
  await mkdir(wiki, { recursive: true });
  const manifest = {
    schemaVersion: 1, reviewedAt: '2026-10-16', localRevision: 'd1a1202', remoteRevision: 'a590a6d',
    pages: ['README.md'],
    contracts: [{ page: 'README.md', path: 'source.txt', includes: ['verified contract'] }],
  };
  const markdown = '# Wiki\n\nRevisión documental: 2026-10-16. Base d1a1202.\n\n## Sección útil\n';
  await writeFile(path.join(wiki, 'README.md'), markdown);
  await writeFile(path.join(root, 'source.txt'), 'verified contract');
  const save = async () => writeFile(path.join(wiki, 'verification.json'), JSON.stringify(manifest));
  await save();
  return { root, wiki, manifest, markdown, save };
}
test('valida enlaces, anchors Unicode y omite enlaces de ejemplos en bloques de código', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.wiki, 'README.md'), f.markdown
    + '\n[Sección](#sección-útil)\n[Fuente](../../source.txt)\n[Web](https://example.com)\n'
    + '\n```text\n[Ejemplo](inexistente.md)\n```\n');
  const result = await validateWiki({ root: f.root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.contracts, 1);
});
test('detecta enlace y anchor rotos', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.wiki, 'README.md'), f.markdown + '\n[No](missing.md) [No](#missing)\n');
  const result = await validateWiki({ root: f.root });
  assert(result.errors.some((error) => error.includes('enlace inexistente')));
  assert(result.errors.some((error) => error.includes('anchor inexistente')));
});
test('detecta cambio de contrato sin exponer el contenido fuente', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, 'source.txt'), 'changed');
  const result = await validateWiki({ root: f.root });
  assert(result.errors.some((error) => error.includes('contrato cambió')));
  assert(!result.errors.some((error) => error.includes('verified contract')));
});
test('detecta páginas sin revisión y no registradas', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.wiki, 'extra.md'), '# Extra\n');
  const result = await validateWiki({ root: f.root });
  assert(result.errors.some((error) => error.includes('Página sin declarar')));
  assert(result.errors.some((error) => error.includes('falta fecha')));
  assert(result.errors.some((error) => error.includes('falta revisión')));
});
test('no permite enlaces fuera del repositorio ni a archivos .env', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.wiki, 'README.md'), f.markdown + '\n[Fuera](../../../outside.txt) [.env](../../.env)\n');
  const result = await validateWiki({ root: f.root });
  assert(result.errors.some((error) => error.includes('fuera del repositorio')));
  assert(result.errors.some((error) => error.includes('secretos')));
});
test('snapshots remotos son explícitos y no hacen fetch', async (t) => {
  const f = await fixture(t);
  f.manifest.contracts[0].revision = 'a590a6d';
  await f.save();
  const local = await validateWiki({ root: f.root });
  assert.deepEqual(local.errors, []);
  assert.equal(local.contracts, 0);
  assert.equal(local.notes.length, 1);
  const remote = await validateWiki({ root: f.root, includeRemote: true });
  assert(remote.errors.some((error) => error.includes('fuente no disponible')));
});
test('detecta manifiesto inválido y página declarada que falta', async (t) => {
  const f = await fixture(t);
  f.manifest.pages.push('missing.md');
  await f.save();
  assert((await validateWiki({ root: f.root })).errors.some((error) => error.includes('Página declarada inexistente')));
  await writeFile(path.join(f.wiki, 'verification.json'), 'null');
  assert((await validateWiki({ root: f.root })).errors.some((error) => error.includes('Estructura')));
});
test('rechaza fuentes de contrato fuera del alcance y contratos mal formados', async (t) => {
  const f = await fixture(t);
  f.manifest.contracts[0].path = '../outside.txt';
  f.manifest.contracts.push(null);
  await f.save();
  const result = await validateWiki({ root: f.root });
  assert(result.errors.some((error) => error.includes('alcance permitido')));
  assert(result.errors.some((error) => error.includes('Contrato inválido')));
});

test('permite revisar una página sin redatar el conjunto y detecta metadatos desalineados', async (t) => {
  const f = await fixture(t);
  f.manifest.reviews = { 'README.md': { reviewedAt: '2026-10-17', revision: 'd1a1202' } };
  await f.save();
  await writeFile(path.join(f.wiki, 'README.md'), f.markdown.replace('2026-10-16', '2026-10-17'));
  assert.deepEqual((await validateWiki({ root: f.root })).errors, []);
  f.manifest.reviews['README.md'].revision = 'a590a6d';
  await f.save();
  assert((await validateWiki({ root: f.root })).errors.some((error) => error.includes('falta revisión')));
});
