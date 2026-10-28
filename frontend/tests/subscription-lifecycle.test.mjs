import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { planDirection } from '../src/app/features/billing/pages/subscription-rules.ts';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(frontend, file), 'utf8');

const catalog = [
  { code: 'BASIC', priceMonthly: 29, priceYearly: 290 },
  { code: 'PRO', priceMonthly: 79, priceYearly: 790 },
  { code: 'ENTERPRISE', priceMonthly: 249, priceYearly: 2490 },
];

test('subir de plan es inmediato; bajar o pasar a anual se programa', () => {
  assert.equal(planDirection(catalog[1], 'PRO', 'MONTHLY', 'MONTHLY', catalog), 'current');
  assert.equal(planDirection(catalog[2], 'PRO', 'MONTHLY', 'MONTHLY', catalog), 'upgrade');
  assert.equal(planDirection(catalog[0], 'PRO', 'MONTHLY', 'MONTHLY', catalog), 'downgrade');
  // El mismo plan en anual cuesta menos por mes: se programa para la renovación.
  assert.equal(planDirection(catalog[1], 'PRO', 'MONTHLY', 'ANNUAL', catalog), 'downgrade');
  assert.equal(planDirection(catalog[1], 'PRO', 'ANNUAL', 'ANNUAL', catalog), 'current');
});

test('facturación lleva a Gestionar suscripción y la ruta exige el permiso de plan', async () => {
  const billing = await read('src/app/features/billing/pages/billing-page.ts');
  assert.match(billing, /routerLink="\/billing\/subscription"/);
  // Sin formulario de tarjeta propio: la tarjeta solo se ingresa en Stripe Checkout.
  assert.doesNotMatch(billing, /4242|MM \/ YY|cardholder/);
  assert.equal((billing.match(/routerLink="\/billing\/subscription"/g) ?? []).length, 1, 'un solo botón Gestionar suscripción');
  const checkout = await read('src/app/features/billing/pages/checkout-page.ts');
  assert.match(checkout, /window\.location\.assign\(url\)/);
  assert.match(checkout, /Continuar a Stripe/);
  assert.doesNotMatch(checkout, /placeholder="4242/);
  const routes = await read('src/app/core/routes/app.routes.ts');
  assert.match(routes, /path: 'billing\/checkout'[\s\S]*?TENANT_PLAN_ADMIN[\s\S]*?path: 'billing\/subscription'[\s\S]*?hasPermissionGuard\(\[\.\.\.TENANT_PLAN_ADMIN\]\)/);
  const modal = await read('src/app/shared/components/upgrade-plan-modal/upgrade-plan-modal.ts');
  assert.match(modal, /navigate\(\['\/billing\/subscription'\]/);
});

test('la cancelación pide nombre exacto, motivo y contraseña, y ofrece descargar un respaldo', async () => {
  const page = await read('src/app/features/billing/pages/subscription-page.ts');
  assert.match(page, /cancelReady\(\): boolean \{[\s\S]*?cancelReason[\s\S]*?cancelPassword[\s\S]*?normalize\(this\.cancelName\)/);
  assert.match(page, /routerLink="\/settings\/backups"/);
  assert.match(page, /No renovar suscripción/);
  assert.match(page, /Desde el próximo período/);
  const service = await read('src/app/core/billing/billing.service.ts');
  for (const endpoint of ['/subscription/upgrade', '/subscription/scheduled-change', '/subscription/stop-renewal',
    '/subscription/resume-renewal', '/subscription/cancel']) {
    assert.ok(service.includes(`/api/v1/billing${endpoint}`), endpoint);
  }
});
