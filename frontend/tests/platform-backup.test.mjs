import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const tenant = await load('src/app/core/http/tenant-session.ts');
const logic = await load('src/app/features/backups/pages/platform-backup.logic.ts', {
  '../../../core/http/tenant-session': tenant,
});

test('503 muestra el estado explicativo con el mensaje del operador', () => {
  const r = logic.describeStartFailure(503, 'El operador de respaldos completos no está configurado');
  assert.equal(r.state, 'unavailable');
  assert.match(r.message, /operador de respaldos completos no está configurado/);
  assert.equal(logic.describeStartFailure(503, undefined).state, 'unavailable');
});

test('409 indica respaldo en curso y otros errores no muestran SQL crudo', () => {
  assert.equal(logic.describeStartFailure(409, 'x').state, 'busy');
  const r = logic.describeStartFailure(500, 'ERROR: relation "x" does not exist');
  assert.equal(r.state, 'error');
  assert.doesNotMatch(r.message, /ERROR:|relation/);
});

test('el sondeo termina en estados finales', () => {
  assert.equal(logic.isTerminalStatus('COMPLETED'), true);
  assert.equal(logic.isTerminalStatus('failed'), true);
  assert.equal(logic.isTerminalStatus('RUNNING'), false);
  assert.equal(logic.viewStateForStatus('COMPLETED'), 'completed');
  assert.equal(logic.viewStateForStatus('FAILED'), 'failed');
  assert.equal(logic.viewStateForStatus('RUNNING'), 'running');
});

test('la pantalla usa los endpoints de plataforma, confirma y consulta el estado', async () => {
  const page = await read('src/app/features/backups/pages/platform-backup-page.ts');
  assert.match(page, /\/api\/v1\/platform\/backups\/full/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /setInterval/);
  assert.match(page, /clearInterval/);
});

test('el menu y la ruta de respaldo de plataforma existen solo para el superadmin', async () => {
  const routes = await read('src/app/features/backups/backups.routes.ts');
  assert.match(routes, /path: 'platform\/backups'[\s\S]*platformAdminGuard/);
  const { navigationRoutes } = await load('src/app/core/data/nexodocs-data.ts');
  const entry = navigationRoutes.find((r) => r.href === '/platform/backups');
  assert.equal(entry.permission, 'platform:tenant:manage');
});

test('el superadmin sin tenant no dispara dashboard ni mantenimiento de respaldos', async () => {
  assert.equal(tenant.isPlatformSession({ platformAdmin: true, tenantId: null }), true);
  assert.equal(tenant.isPlatformSession({ platformAdmin: true, tenantId: 't1' }), false);
  assert.equal(tenant.isPlatformSession({ platformAdmin: false, tenantId: null }), false);
  assert.match(await read('src/app/core/api/workspace-api.service.ts'), /isPlatformSession\(this\.auth\.user\(\)\)\) return of/);
  assert.match(await read('src/app/core/api/backup-maintenance.service.ts'), /isPlatformSession\(this\.auth\.user\(\)\)/);
});

test('errores crudos de base de datos se reemplazan por un mensaje amable', () => {
  assert.equal(tenant.friendlyApiMessage('ERROR: permission denied for table x'), tenant.GENERIC_ERROR_MESSAGE);
  assert.equal(tenant.friendlyApiMessage('org.hibernate.exception.ConstraintViolationException'), tenant.GENERIC_ERROR_MESSAGE);
  assert.equal(tenant.friendlyApiMessage('El correo ya existe'), 'El correo ya existe');
  assert.equal(tenant.friendlyApiMessage(undefined, 'fb'), 'fb');
});

test('Control de ingresos solo se muestra y consulta con permiso de plataforma', async () => {
  const billing = await read('src/app/features/billing/pages/billing-page.ts');
  assert.match(billing, /\*ngIf="canSeeRevenue"/);
  assert.match(billing, /if\(this\.canSeeRevenue\)\{this\.billing\.loadRevenue\(\)/);
});
