import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/app/features/document-operations/translations-page.ts', import.meta.url), 'utf8');

test('crear y publicar traducciones reales respeta permisos y revision por otra persona', () => {
  assert.match(page, /readonly creationEnabled = true;/);
  assert.match(page, /@if\(creationEnabled && can\('translation:create'\)\)\{\s*<button[^>]*\(click\)="openNewDialog\(\)"/);
  assert.match(page, /@if\(can\('translation:publish'\) && editable\(d\) && !isRequester\(d\)\)/);
});

test('cancelar y editar segmentos respetan permisos y estados que acepta el backend', () => {
  assert.match(page, /@if\(can\('translation:create'\) && editable\(d\)\)\{\s*<button class="danger"/);
  assert.match(page, /@if\(!editable\(d\) \|\| isRequester\(d\) \|\| !can\('translation:review'\)\)/);
});

test('todos los estados de 097_document_translations tienen etiqueta', () => {
  for (const status of ['QUEUED', 'EXTRACTING', 'TRANSLATING', 'REVIEW_PENDING', 'CHANGES_REQUESTED', 'PUBLISHED', 'CANCELLED', 'FAILED']) {
    assert.match(page, new RegExp(`\\b${status}: '`), `falta etiqueta para ${status}`);
  }
});
