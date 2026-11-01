import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const logic = await load('src/app/features/platform-admin/pages/platform-plans.logic.ts');

test('solo se envían los límites que cambiaron y se rechazan valores inválidos', () => {
  const current = { maxUsers: 10, maxStorageMB: 5120, maxDocuments: 500, maxOcrPagesPerMonth: 0 };
  assert.deepEqual({ ...logic.changedLimits(current, { ...current, maxUsers: '25' }) }, { maxUsers: 25 });
  assert.deepEqual({ ...logic.changedLimits(current, { ...current }) }, {});
  assert.deepEqual({ ...logic.changedLimits(current, { ...current, maxDocuments: -1 }) }, { maxDocuments: -1 });
  assert.equal(logic.changedLimits(current, { ...current, maxUsers: -2 }), null);
  assert.equal(logic.changedLimits(current, { ...current, maxUsers: 1.5 }), null);
  assert.equal(logic.changedLimits(current, { ...current, maxUsers: 'abc' }), null);
});

test('solo se envían las funcionalidades que cambiaron', () => {
  const current = [{ key: 'workflows', enabled: true }, { key: 'ocr_scanning', enabled: false }];
  assert.deepEqual({ ...logic.changedFeatures(current, { workflows: false, ocr_scanning: false }) }, { workflows: false });
});

test('el 409 CONFIRMATION_REQUIRED pide confirmar el impacto', () => {
  assert.equal(logic.needsImpactConfirmation(409, { code: 'CONFIRMATION_REQUIRED' }), true);
  assert.equal(logic.needsImpactConfirmation(409, { code: 'OTHER' }), false);
  assert.equal(logic.needsImpactConfirmation(402, { code: 'CONFIRMATION_REQUIRED' }), false);
});

test('montos con dos decimales como máximo', () => {
  assert.equal(logic.isValidAmount(89.99), true);
  assert.equal(logic.isValidAmount('0'), true);
  assert.equal(logic.isValidAmount(-1), false);
  assert.equal(logic.isValidAmount(10.001), false);
  assert.equal(logic.isValidAmount(null), false);
});

test('clientes con precio anterior y ahorro anual', () => {
  const prices = [
    { billingCycle: 'MONTHLY', archivedAt: null, tenants: 4 },
    { billingCycle: 'MONTHLY', archivedAt: '2026-10-01', tenants: 3 },
    { billingCycle: 'ANNUAL', archivedAt: '2026-10-01', tenants: 9 },
  ];
  assert.equal(logic.grandfatheredTenants(prices, 'MONTHLY'), 3);
  assert.equal(logic.annualSavingsPercent(79, 790), 17);
  assert.equal(logic.annualSavingsPercent(0, 790), 0);
});

test('/planes no muestra precios inventados si falla el catálogo', async () => {
  const page = await read('src/app/features/pricing/pages/pricing-page.ts');
  assert.doesNotMatch(page, /priceMonthly: (29|79|249),/, 'no debe haber planes de respaldo con precios fijos');
  assert.match(page, /loadError\.set\(true\)/);
});

test('la ruta del catálogo exige cuenta de plataforma', async () => {
  const routes = await read('src/app/features/platform-admin/platform-admin.routes.ts');
  const start = routes.indexOf("path: 'platform/plans'");
  assert.ok(start >= 0);
  assert.ok(routes.slice(start, routes.indexOf('}', start)).includes('canActivate: [authGuard, platformAdminGuard]'));
});
