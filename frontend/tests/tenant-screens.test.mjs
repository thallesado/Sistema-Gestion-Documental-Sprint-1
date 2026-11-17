import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const logic = await load('src/app/features/platform-admin/pages/platform-tenant-usage.logic.ts');

test('uso de almacenamiento: orden por porcentaje usado e ilimitado al final', () => {
  const row = (used, limit) => ({ usage: { storageBytes: { used, limit } } });
  assert.equal(logic.storageRatio(row(50, 100)), 0.5);
  assert.equal(logic.storageRatio(row(50, -1)), -1);
  assert.ok(logic.storageRatio(row(10, 0)) > 1);
});

test('branding: solo colores hexadecimales y logos https o del propio sitio', () => {
  assert.equal(logic.brandColor('#2563eb'), '#2563eb');
  assert.equal(logic.brandColor('red; background:url(x)'), null);
  assert.equal(logic.safeLogoUrl('https://cdn.test/logo.png'), 'https://cdn.test/logo.png');
  assert.equal(logic.safeLogoUrl('javascript:alert(1)'), null);
  assert.equal(logic.safeLogoUrl('data:image/png;base64,AAA'), null);
  assert.equal(logic.initials('Clínica Central'), 'CC');
});

test('las pantallas del módulo Tenants ya no usan la página genérica con datos de ejemplo', async () => {
  const routes = await read('src/app/core/routes/app.routes.ts');
  for (const path of ['tenants/active', 'tenants/suspended', 'tenants/storage', 'tenants/branding']) {
    assert.match(routes, new RegExp(`sprintOwnedPaths = new Set\\([^)]*'${path.replace('/', '\\/')}'`));
  }
  const users = await read('src/app/features/users/users.routes.ts');
  assert.match(users, /path: 'tenants\/active'[\s\S]*?administracion-page/);
  assert.match(users, /path: 'tenants\/suspended'[\s\S]*?administracion-page/);
  const platform = await read('src/app/features/platform-admin/platform-admin.routes.ts');
  assert.match(platform, /path: 'tenants\/storage'[\s\S]*?platformAdminGuard/);
  assert.match(platform, /path: 'tenants\/branding'[\s\S]*?platformAdminGuard/);
});

test('la página genérica recupera sus estilos base perdidos', async () => {
  const page = await read('src/app/features/tablero/pages/espacio-trabajo-page.ts');
  for (const selector of ['.stats {', '.list-toolbar {', '.list article {', '.panel {', '.row-menu {']) {
    assert.ok(page.includes(selector), `falta ${selector}`);
  }
});
