import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const [appHtml, appTs, docPage, expPage] = await Promise.all([
  read('frontend/src/app/shell/app.html'),
  read('frontend/src/app/shell/app.ts'),
  read('frontend/src/app/features/documentos/pages/documentos-page.ts'),
  read('frontend/src/app/features/expedientes/pages/expedientes-page.ts'),
]);

test('topbar global search form binds input and submits via onGlobalSearch', () => {
  assert.match(appHtml, /\(submit\)="onGlobalSearch\(\$event\)"/);
  assert.match(appHtml, /\[value\]="globalSearchTerm\(\)"/);
  assert.match(appHtml, /\(input\)="globalSearchTerm\.set/);
  assert.match(appHtml, /\(keydown\.enter\)="onGlobalSearch\(\$event\)"/);
});

test('app.ts implements context-aware global search navigation', () => {
  assert.match(appTs, /readonly globalSearchTerm = signal\(''\)/);
  assert.match(appTs, /onGlobalSearch\(event\?: Event\): void/);
  assert.match(appTs, /url\.startsWith\('\/expedients'\)/);
  assert.match(appTs, /this\.router\.navigate\(\['\/documents'\], \{ queryParams: \{ q: term \} \}\)/);
});

test('documentos-page.ts consumes queryParam q and updates search signal', () => {
  assert.match(docPage, /this\.route\.queryParamMap\.subscribe/);
  assert.match(docPage, /this\.search\.set\(q\)/);
});

test('expedientes-page.ts initializes search from route query parameters', () => {
  assert.match(expPage, /this\.route\.snapshot\.queryParamMap\.get\('q'\)/);
  assert.match(expPage, /this\.search\.set\(qParam\)/);
});
