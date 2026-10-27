import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { allowedDocumentTypes, permittedLandingPage } from '../src/app/core/auth/permission-rules.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const routes = [
  { href: '/documents', permission: 'document:read' },
  { href: '/workflows/tasks', permission: 'workflow:read' },
];

test('la pantalla de inicio personalizada solo se usa si el usuario puede abrirla', () => {
  assert.equal(permittedLandingPage('/documents', ['document:read'], routes), '/documents');
  assert.equal(permittedLandingPage('/workflows/tasks', ['document:read'], routes), null);
  assert.equal(permittedLandingPage('/', ['document:read'], routes), null);
  assert.equal(permittedLandingPage('/no-existe', ['document:read'], routes), null);
  assert.equal(permittedLandingPage(null, ['document:read'], routes), null);
});

test('los tipos documentales se limitan a los permitidos; sin lista, todos', () => {
  const types = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(allowedDocumentTypes(types, []), types);
  assert.deepEqual(allowedDocumentTypes(types, null), types);
  assert.deepEqual(allowedDocumentTypes(types, ['b']), [{ id: 'b' }]);
});

test('las pantallas de inicio del modal coinciden con la lista del backend', async () => {
  const modal = await read('frontend/src/app/features/users/components/user-customization-modal.ts');
  const service = await read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/UserCustomizationService.java');
  const frontend = [...modal.matchAll(/\{ value: '([^']+)', label:/g)].map((m) => m[1]).sort();
  const block = service.match(/LANDING_PAGES = Set\.of\(([\s\S]*?)\);/)[1];
  const backend = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(frontend, backend);
});

test('el botón Personalizar exige user:customize y el endpoint también', async () => {
  const page = await read('frontend/src/app/features/users/pages/administracion-page.ts');
  assert.match(page, /\*appHasPermission="'user:customize'"[^>]*>Personalizar</);
  const controller = await read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/UserController.java');
  assert.equal((controller.match(/hasAuthority\('user:customize'\) and hasAuthority\('user:read'\)/g) ?? []).length, 3);
  // La imagen Docker del frontend no copia database/; allí se omite esta comprobación.
  const migration = await read('database/init/060_user_customizations.sql').catch(() => null);
  if (migration) assert.match(migration, /'user:customize', 'user', 'customize'/);
});

test('la portada de Configuración enlaza solo a pantallas reales y ofrece el manual en PDF', async () => {
  const page = await read('frontend/src/app/features/settings/pages/settings-home-page.ts');
  const routes = await read('frontend/src/app/core/routes/app.routes.ts');
  const settingsRoutes = await read('frontend/src/app/features/settings/settings.routes.ts');
  assert.match(settingsRoutes, /path: 'settings',[\s\S]*?settings-home-page/);
  assert.match(routes, /sprintOwnedPaths = new Set\(\['settings',/);
  for (const href of [...page.matchAll(/href: '([^']+)'/g)].map((m) => m[1])) {
    const known = ['/settings/appearance', '/users', '/users/roles', '/users/form-permissions', '/settings/statuses', '/settings/backups', '/audit', '/billing/subscription'];
    assert.ok(known.includes(href), `destino sin pantalla: ${href}`);
  }
  assert.match(page, /MANUAL_PDF_URL = '\/assets\/manual\/manual-de-uso-nexodocs\.pdf'/);
  const pdf = await readFile(path.join(root, 'frontend/public/assets/manual/manual-de-uso-nexodocs.pdf'));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
