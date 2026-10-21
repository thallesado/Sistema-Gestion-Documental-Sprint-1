import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const [documentApi, documentPage, documentController, documentService] = await Promise.all([
  read('frontend/src/app/core/api/document-api.service.ts'),
  read('frontend/src/app/features/documentos/pages/documentos-page.ts'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DocumentController.java'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/DocumentService.java'),
]);

test('DocumentController exposes GET /api/v1/documents/shared with document:read authority', () => {
  assert.match(documentController, /@GetMapping\("\/shared"\)/);
  assert.match(documentController, /@PreAuthorize\("hasAuthority\('document:read'\)"\)/);
  assert.match(documentController, /findShared\(/);
});

test('DocumentService implements findShared with tenant context and status filtering', () => {
  assert.match(documentService, /public Page<DocumentResponse> findShared\(/);
  assert.match(documentService, /repository\.searchSharedAndStatus/);
  assert.match(documentService, /repository\.searchShared/);
});

test('DocumentApiService routes shared scope to /documents/shared', () => {
  assert.match(documentApi, /scope === 'shared' \? '\/documents\/shared'/);
});

test('DocumentosPage sets title and queries shared scope on /documents/shared', () => {
  assert.match(documentPage, /url === '\/documents\/shared' \? 'shared'/);
  assert.match(documentPage, /this\.pageTitle\.set\('Compartidos conmigo'\)/);
});
