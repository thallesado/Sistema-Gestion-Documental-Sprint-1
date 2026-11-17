import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const logic = await load('src/app/features/billing/pages/discounts.logic.ts');

const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const base = { code: 'LANZ-20', name: 'Lanzamiento', type: 'PERCENT', value: 20, duration: 'ONCE', months: null, plans: ['PRO'], redeemBy: future(30) };

test('un cupón sin fecha de fin o con fecha pasada se rechaza', async () => {
  assert.equal(logic.couponFormError(base, 50), null);
  assert.match(logic.couponFormError({ ...base, redeemBy: '' }, 50), /obligatoria/);
  assert.match(logic.couponFormError({ ...base, redeemBy: future(-2) }, 50), /futura/);
});

test('un porcentaje por encima del tope se rechaza', async () => {
  assert.match(logic.couponFormError({ ...base, value: 60 }, 50), /tope de 50 %/);
  assert.equal(logic.couponFormError({ ...base, value: 50 }, 50), null);
});

test('la duración en meses es obligatoria para un descuento de varios meses', async () => {
  assert.match(logic.couponFormError({ ...base, duration: 'REPEATING', months: null }, 50), /meses/);
  assert.equal(logic.couponFormError({ ...base, duration: 'REPEATING', months: 3 }, 50), null);
  assert.match(logic.couponFormError({ ...base, plans: [] }, 50), /plan/);
});

test('un código promocional no puede vencer después que su cupón', async () => {
  const redeemBy = new Date(Date.now() + 10 * 86_400_000).toISOString();
  assert.equal(logic.promotionCodeFormError('LANZAMIENTO2026', future(5), redeemBy, null), null);
  assert.match(logic.promotionCodeFormError('LANZAMIENTO2026', future(20), redeemBy, null), /después que su cupón/);
  assert.match(logic.promotionCodeFormError('LANZAMIENTO2026', '', redeemBy, null), /obligatorio/);
  assert.match(logic.promotionCodeFormError('a', future(5), redeemBy, null), /3 a 40/);
  assert.match(logic.promotionCodeFormError('LANZAMIENTO2026', future(5), redeemBy, 0.5), /entero/);
});

test('el fin del día no supera el límite del cupón', async () => {
  const limit = new Date(Date.now() + 3 * 3_600_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(new Date(logic.endOfDayIso(today, limit)).getTime() <= new Date(limit).getTime());
});

test('códigos, valores y duraciones legibles', async () => {
  assert.equal(logic.normalizePromotionCode(' lanzamiento2026 '), 'LANZAMIENTO2026');
  assert.equal(logic.isValidPromotionCode('LANZAMIENTO2026'), true);
  assert.equal(logic.isValidPromotionCode('con espacio'), false);
  assert.equal(logic.discountValueLabel(20, null), '20 %');
  assert.equal(logic.durationLabel('REPEATING', 3), 'durante 3 meses');
  assert.equal(logic.durationLabel('ONCE', null), 'en un solo pago');
  assert.equal(logic.activeDiscountText({ percentOff: 10, amountOffUsd: null }, '15/04/2026'), '10 % de descuento hasta el 15/04/2026.');
  assert.equal(logic.promotionSummary({ code: 'LANZ', percentOff: 20, amountOffUsd: null, duration: 'REPEATING', durationInMonths: 3 }),
    'Código LANZ: 20 % durante 3 meses');
});

test('la vista de plataforma pide motivo y la ruta exige administración global', async () => {
  const page = await read('src/app/features/platform-admin/pages/platform-discounts-page.ts');
  assert.match(page, /isValidReason/);
  assert.match(page, /Fecha de fin \(obligatoria\)/);
  const routes = await read('src/app/features/platform-admin/platform-admin.routes.ts');
  assert.match(routes, /path: 'platform\/discounts'[\s\S]*?platformAdminGuard/);
});

test('el checkout solo envía el código validado y solo con tarjeta', async () => {
  const checkout = await read('src/app/features/billing/pages/checkout-page.ts');
  assert.match(checkout, /appliedPromotion = computed\(\(\) => \(this\.method\(\) === 'STRIPE_CARD'/);
  assert.match(checkout, /const promo = this\.appliedPromotion\(\)\?\.code \?\? null/);
  const pricing = await read('src/app/features/pricing/pages/pricing-page.ts');
  assert.match(pricing, /promotionCode: this\.promotion\(\)\?\.code \?\? null/);
});
