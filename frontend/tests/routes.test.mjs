import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const source = await readFile(path.join(frontend, 'src/app/core/data/nexodocs-data.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('require', 'exports', compiled)(require, exports);
const { navigationRoutes, routeFor } = exports;

test('cada opcion del menu tiene una URL unica en Angular', () => {
  const hrefs = navigationRoutes.map((route) => route.href);
  assert.equal(new Set(hrefs).size, hrefs.length, 'Hay URLs duplicadas en el menu');
  assert.equal(hrefs.length, 80, 'Debe conservarse el mapa funcional de 80 pantallas');
  assert.equal(routeFor('Documentos', 'Nuevo documento'), '/documents/new');
  assert.equal(routeFor('Tenants', 'Branding'), '/tenants/branding');
  assert.throws(() => routeFor('Modulo inexistente'), /Ruta no definida/);
});

test('todas las URLs sirven su contenido, login y 404', { skip: !process.env.APP_URL }, async () => {
  const base = process.env.APP_URL;
  for (const route of navigationRoutes) {
    const response = await fetch(new URL(route.href, base));
    assert.equal(response.status, 200, route.href);
    const html = await response.text();
    assert.match(html, /<app-root><\/app-root>/, route.href);
  }
  assert.equal((await fetch(new URL('/login', base))).status, 200);
  assert.equal((await fetch(new URL('/ruta-inexistente', base))).status, 200);
});
