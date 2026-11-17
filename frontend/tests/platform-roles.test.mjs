import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const support = await load('src/app/features/auth/pages/support-session.logic.ts');
const team = await load('src/app/features/platform-admin/pages/platform-team.logic.ts');

const jwt = 'aaa.bbb.ccc';

test('el token de soporte solo se toma del fragmento y con forma de JWT', () => {
  assert.equal(support.supportTokenFromHash(`#token=${jwt}`), jwt);
  assert.equal(support.supportTokenFromHash('#token=<script>'), null);
  assert.equal(support.supportTokenFromHash(''), null);
  assert.equal(support.supportSessionUrl(jwt), `/support-session#token=${jwt}`);
});

test('la sesión de soporte informa los minutos restantes', () => {
  const now = Date.parse('2026-10-27T10:00:00Z');
  assert.equal(support.minutesLeft('2026-10-27T10:30:00Z', now), 30);
  assert.equal(support.minutesLeft('2026-10-27T09:00:00Z', now), 0);
  assert.equal(support.minutesLeft(null, now), 0);
});

test('una solicitud de soporte exige organización, módulos, duración y motivo', () => {
  assert.match(support.supportRequestError('', ['DOCUMENTS'], 60, 'Revisar un error'), /organización/);
  assert.match(support.supportRequestError('t', [], 60, 'Revisar un error'), /módulo/);
  assert.match(support.supportRequestError('t', ['DOCUMENTS'], 300, 'Revisar un error'), /15 a 240/);
  assert.match(support.supportRequestError('t', ['DOCUMENTS'], 60, 'no'), /motivo/);
  assert.equal(support.supportRequestError('t', ['DOCUMENTS'], 120, 'Revisar un documento que no abre'), null);
});

test('alta de cuentas de plataforma con contraseña temporal larga y rol válido', () => {
  const ok = { firstName: 'Ana', lastName: 'Rojas', username: 'ana.rojas', email: 'ana@nexodocs.test', roleCode: 'SUPPORT', temporaryPassword: 'Temporal-2026!' };
  assert.equal(team.memberFormError(ok), null);
  assert.match(team.memberFormError({ ...ok, temporaryPassword: 'corta' }), /12 caracteres/);
  assert.match(team.memberFormError({ ...ok, roleCode: 'ROOT' }), /rol/);
  assert.match(team.memberFormError({ ...ok, email: 'no-es-correo' }), /correo/);
});

test('una sesión de soporte no entra al área de plataforma', async () => {
  const guard = await read('src/app/core/auth/auth.guard.ts');
  assert.match(guard, /platformAdmin === true && !auth\.user\(\)\?\.tenantId\) \|\| deny/);
  assert.match(guard, /platformAdmin === true && !user\.tenantId\) \|\| deny/);
});

test('el login de plataforma no guarda tokens hasta el doble factor', async () => {
  const service = await read('src/app/core/auth/auth.service.ts');
  assert.match(service, /if \(response\.mfaRequired\) return;/);
  assert.match(service, /auth\/mfa\/\$\{enroll \? 'enroll' : 'verify'\}/);
  const page = await read('src/app/features/auth/pages/login-page.ts');
  assert.match(page, /autocomplete="one-time-code"/);
});

test('la ficha muestra cada acción solo con la autoridad de su rol', async () => {
  const page = await read('src/app/features/platform-admin/pages/platform-tenant-page.ts');
  assert.match(page, /actions\(\)\.suspend && can\.lifecycle/);
  assert.match(page, /actions\(\)\.extendTrial && can\.trial/);
  assert.match(page, /actions\(\)\.changePlan && can\.billing/);
  assert.deepEqual(Object.keys(team.ROLE_LABELS), ['SUPERADMIN', 'FINANCE', 'SUPPORT', 'OPERATIONS']);
});

test('no existe una opción para iniciar sesión como usuario del tenant', async () => {
  const api = await read('src/app/core/api/support-access-api.service.ts');
  assert.doesNotMatch(api, /impersonat|login-as|loginAs|switch-user/i);
});
