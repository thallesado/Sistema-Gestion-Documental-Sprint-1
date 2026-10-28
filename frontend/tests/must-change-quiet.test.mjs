import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('mientras la contraseña es temporal no se piden endpoints de tenant (evita 403 antes de la redirección)', () => {
  const helper = read('core/http/tenant-session.ts');
  assert.match(helper, /export function mustSkipTenantRequests/, 'Falta el helper compartido');
  assert.match(helper, /mustChangePassword/, 'El helper debe considerar el cambio obligatorio');

  const backups = read('core/api/backup-maintenance.service.ts');
  assert.match(backups, /mustSkipTenantRequests/, 'backups/maintenance no debe llamarse con clave temporal');

  const workspace = read('core/api/workspace-api.service.ts');
  assert.match(workspace, /mustSkipTenantRequests/, 'el dashboard no debe llamarse con clave temporal');

  const auth = read('core/auth/auth.service.ts');
  assert.match(auth, /mustSkipTenantRequests|mustChangePassword\(\)/, 'los ajustes del tenant no deben pedirse con clave temporal');
});

test('el helper sigue omitiendo las llamadas de tenant para el superadmin de plataforma', () => {
  const helper = read('core/http/tenant-session.ts');
  assert.match(helper, /isPlatformSession/);
});

test('el shell no carga el plan y la suscripcion mientras la contraseña es temporal', () => {
  const shell = read('shell/app.ts');
  assert.match(shell, /isWorkspace\(\)\s*&&\s*!this\.auth\.mustChangePassword\(\)\)\s*this\.subscription\.load\(\)/);
});

test('la ruta raiz tambien manda a cambiar la contraseña temporal sin depender de un 403', () => {
  const guard = read('core/auth/auth.guard.ts');
  const root = guard.match(/export const rootEntryGuard[\s\S]*?\n};/)?.[0] ?? '';
  assert.match(root, /mustChangePassword\(\)/, 'rootEntryGuard debe redirigir con clave temporal');
  assert.match(root, /\/change-password/);
});
