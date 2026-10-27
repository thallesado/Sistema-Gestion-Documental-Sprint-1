import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const logic = await load('src/app/features/billing/pages/addons.logic.ts');

test('cantidades legibles por recurso', () => {
  assert.equal(logic.quantityLabel('maxStorageMB', 10240), '10 GB');
  assert.equal(logic.quantityLabel('maxStorageMB', 500), '500 MB');
  assert.equal(logic.quantityLabel('maxUsers', 5), '5 usuarios');
  assert.equal(logic.quantityLabel('maxUsers', 1), '1 usuario');
});

test('total y unidades válidas', () => {
  assert.equal(logic.addonTotal(9, 3), 27);
  assert.equal(logic.addonTotal(9.99, 2), 19.98);
  assert.equal(logic.validUnits(1), true);
  assert.equal(logic.validUnits(0), false);
  assert.equal(logic.validUnits(101), false);
  assert.equal(logic.validUnits(1.5), false);
});

test('un recurrente con suscripción de Stripe solo se paga con la misma suscripción', () => {
  assert.deepEqual([...logic.paymentMethodsFor('RECURRING', true, true)], ['STRIPE_CARD']);
  assert.deepEqual([...logic.paymentMethodsFor('RECURRING', true, false)], []);
  assert.deepEqual([...logic.paymentMethodsFor('RECURRING', false, true)], ['BANK_QR', 'CRYPTO_USDT']);
  assert.deepEqual([...logic.paymentMethodsFor('CONSUMABLE', false, true)], ['STRIPE_CARD', 'BANK_QR', 'CRYPTO_USDT']);
});

test('solo se reduce lo comprado con la suscripción de Stripe', () => {
  assert.equal(logic.canReduce({ stripeManaged: true, kind: 'RECURRING', pendingUnits: null }), true);
  assert.equal(logic.canReduce({ stripeManaged: false, kind: 'RECURRING', pendingUnits: null }), false);
  assert.equal(logic.canReduce({ stripeManaged: true, kind: 'CONSUMABLE', pendingUnits: null }), false);
});

test('la pestaña Complementos y la vista de plataforma están conectadas', async () => {
  const page = await read('src/app/features/billing/pages/subscription-page.ts');
  assert.match(page, /<app-subscription-addons \/>/);
  const routes = await read('src/app/features/platform-admin/platform-admin.routes.ts');
  const start = routes.indexOf("path: 'platform/addons'");
  assert.ok(start >= 0);
  assert.ok(routes.slice(start, routes.indexOf('}', start)).includes('canActivate: [authGuard, platformAdminGuard]'));
  const ficha = await read('src/app/features/platform-admin/pages/platform-tenant-page.ts');
  assert.match(ficha, /grantCourtesy\(/);
});
