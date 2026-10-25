import assert from 'node:assert/strict';
import test from 'node:test';
import { read } from './helpers-u4.mjs';

test('/settings/backups exige backup:read y redirige a /access-denied (mismo mecanismo que form-permissions)', async () => {
  const routes = await read('src/app/features/backups/backups.routes.ts');
  assert.match(routes, /path: 'settings\/backups'[\s\S]*?hasPermissionGuard\('backup:read'\)/);
  const guard = await read('src/app/core/auth/auth.guard.ts');
  assert.match(guard, /hasPermissionGuard[\s\S]*\/access-denied/);
});

test('/settings/appearance usa el permiso del admin del tenant, el mismo que su entrada de menu', async () => {
  const routes = await read('src/app/features/settings/settings.routes.ts');
  assert.match(routes, /hasPermissionGuard\(\['tenant:update', 'tenant:manage'\]\)/);
});

test('el catalogo generico no reclama /platform/backups', async () => {
  assert.match(await read('src/app/core/routes/app.routes.ts'), /sprintOwnedPaths = new Set\([^)]*'platform\/backups'/);
});
