import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/app/features/document-operations/translations-page.ts', import.meta.url), 'utf8');

test('crear y publicar traducciones no se ofrecen mientras el backend responde 503', () => {
  // DocumentTranslationService.create/publish lanzan 503 siempre (ver operaciones-documentales.md).
  assert.match(page, /readonly creationEnabled = false;/);
  assert.match(page, /@if\(creationEnabled && can\('translation:create'\)\)\{\s*<button[^>]*\(click\)="openNewDialog\(\)"/);
  assert.match(page, /@if\(creationEnabled && can\('translation:publish'\)/);
});

test('cancelar y editar segmentos respetan permisos y estados que acepta el backend', () => {
  assert.match(page, /@if\(d\['status'\] === 'REVIEW_PENDING' && can\('translation:create'\)\)\{\s*<button class="danger"/);
  assert.match(page, /@if\(can\('translation:review'\) && \(d\['status'\] === 'REVIEW_PENDING' \|\| d\['status'\] === 'CHANGES_REQUESTED'\)\)\{\s*<textarea/);
});

test('todos los estados de 097_document_translations tienen etiqueta', () => {
  for (const status of ['QUEUED', 'EXTRACTING', 'TRANSLATING', 'REVIEW_PENDING', 'CHANGES_REQUESTED', 'PUBLISHED', 'CANCELLED', 'FAILED']) {
    assert.match(page, new RegExp(`\\b${status}: '`), `falta etiqueta para ${status}`);
  }
});
