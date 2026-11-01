import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const logic = await load('src/app/features/platform-admin/pages/platform-tenant.logic.ts');

test('el motivo es obligatorio con el mismo criterio que el backend', () => {
  assert.equal(logic.isValidReason(''), false);
  assert.equal(logic.isValidReason('   abc  '), false);
  assert.equal(logic.isValidReason('x'.repeat(1001)), false);
  assert.equal(logic.isValidReason('Impago reiterado'), true);
});

test('las barras de consumo distinguen ilimitado, aviso y exceso', () => {
  assert.deepEqual(logic.usageBar(10, -1), { percent: 0, tone: 'unlimited' });
  assert.equal(logic.usageBar(5, 10).tone, 'ok');
  assert.equal(logic.usageBar(8, 10).tone, 'warn');
  assert.deepEqual(logic.usageBar(12, 10), { percent: 100, tone: 'over' });
});

test('las acciones dependen del estado y de Stripe', () => {
  assert.deepEqual(logic.availableActions('TRIAL', false), { suspend: true, reactivate: false, extendTrial: true, changePlan: true });
  assert.equal(logic.availableActions('TRIAL', true).extendTrial, false);
  assert.equal(logic.availableActions('ACTIVE', true).changePlan, false);
  assert.equal(logic.availableActions('PENDING_DELETION', false).reactivate, true);
  assert.deepEqual(logic.availableActions('PURGED', false), { suspend: false, reactivate: false, extendTrial: false, changePlan: false });
});

test('el 402 PLAN_LIMIT_EXCEEDED del cambio de plan pide confirmación', () => {
  assert.equal(logic.needsOverLimitConfirmation(402, { code: 'PLAN_LIMIT_EXCEEDED' }), true);
  assert.equal(logic.needsOverLimitConfirmation(402, {}), false);
  assert.equal(logic.needsOverLimitConfirmation(409, { code: 'PLAN_LIMIT_EXCEEDED' }), false);
});

test('antes/después se muestran legibles', () => {
  assert.equal(logic.describeState('{"status":"ACTIVE","x":null}'), 'status: ACTIVE');
  assert.equal(logic.describeState(null), '—');
});

test('la ficha solo usa campos del contrato permitido (anexo A)', async () => {
  const api = await read('src/app/core/api/platform-api.service.ts');
  const page = await read('src/app/features/platform-admin/pages/platform-tenant-page.ts');
  for (const word of ['patient', 'paciente', 'filename', 'fileName', 'metadata', 'clinical', 'expedient']) {
    assert.doesNotMatch(api, new RegExp(word, 'i'), `el contrato no debe exponer ${word}`);
    assert.doesNotMatch(page, new RegExp(`[.]${word}`, 'i'), `la ficha no debe leer ${word}`);
  }
});

test('rutas de plataforma protegidas y acciones con motivo', async () => {
  const routes = await read('src/app/features/platform-admin/platform-admin.routes.ts');
  for (const path of ['platform/tenants/:id', 'platform/audit']) {
    const start = routes.indexOf(`path: '${path}'`);
    assert.ok(start >= 0, `falta la ruta ${path}`);
    const block = routes.slice(start, routes.indexOf('}', start));
    assert.ok(block.includes('canActivate: [authGuard, platformAdminGuard]'), `${path} debe exigir platformAdminGuard`);
  }
  const admin = await read('src/app/core/api/administration-api.service.ts');
  assert.match(admin, /changeTenantStatus\(id: string, value: string, reason: string\)/);
  assert.match(admin, /createTenant\(payload: CreateTenantPayload, reason: string\)/);
  const backup = await read('src/app/features/backups/pages/platform-backup-page.ts');
  assert.match(backup, /params: \{ reason: this\.reason\.trim\(\) \}/);
});
