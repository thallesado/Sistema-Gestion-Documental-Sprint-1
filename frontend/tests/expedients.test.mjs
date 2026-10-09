import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const [expedientApi, expedientPage, expedientHtml, expedientController] = await Promise.all([
  read('frontend/src/app/core/api/expedient-api.service.ts'),
  read('frontend/src/app/features/expedientes/pages/expedientes-page.ts'),
  read('frontend/src/app/features/expedientes/pages/expedientes-page.html'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/ExpedientController.java'),
]);

test('ExpedientApiService supports status query parameter and lifecycle mutation methods', () => {
  assert.match(expedientApi, /close\(id: string\): Observable<ApiExpedient>/);
  assert.match(expedientApi, /archive\(id: string\): Observable<ApiExpedient>/);
  assert.match(expedientApi, /reopen\(id: string\): Observable<ApiExpedient>/);
  assert.match(expedientApi, /updateStatus\(id: string, status: string\): Observable<ApiExpedient>/);
  assert.match(expedientApi, /params\.set\('status', status\.trim\(\)\.toUpperCase\(\)\)/);
});

test('ExpedientsPage filters by status at database level and provides actions to close/archive', () => {
  assert.match(expedientPage, /this\.api\.expedients\(this\.search\(\), this\.viewStatusFilter\)/);
  assert.match(expedientPage, /closeExpedient\(item: ExpedientItem\)/);
  assert.match(expedientPage, /archiveExpedient\(item: ExpedientItem\)/);
  assert.match(expedientPage, /reopenExpedient\(item: ExpedientItem\)/);
  assert.match(expedientPage, /canUpdateExpedient\(\)/);
});

test('ExpedientsPage template renders close and archive actions in the detail panel', () => {
  assert.match(expedientHtml, /closeExpedient\(item\)/);
  assert.match(expedientHtml, /archiveExpedient\(item\)/);
  assert.match(expedientHtml, /reopenExpedient\(item\)/);
  assert.match(expedientHtml, /canUpdateExpedient\(\)/);
});

test('ExpedientController exposes status filtering and lifecycle endpoints with expedient:update authority', () => {
  assert.match(expedientController, /@RequestParam\(required = false\) Expedient\.ExpedientStatus status/);
  assert.match(expedientController, /@PatchMapping\("\/\{id\}\/close"\)/);
  assert.match(expedientController, /@PatchMapping\("\/\{id\}\/archive"\)/);
  assert.match(expedientController, /@PatchMapping\("\/\{id\}\/reopen"\)/);
  assert.match(expedientController, /@PreAuthorize\("hasAuthority\('expedient:update'\)"\)/);
});
