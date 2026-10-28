import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(frontend, file), 'utf8');
const exists = async (file) => {
  try {
    await access(path.join(frontend, file));
    return true;
  } catch {
    return false;
  }
};

test('help center markdown articles exist with structured documentation', async () => {
  const articles = ['ocr.md', 'workflows.md', 'expedientes.md', 'usuarios-roles.md', 'primer-uso.md'];
  for (const art of articles) {
    const srcPath = `src/assets/help/${art}`;
    const pubPath = `public/assets/help/${art}`;
    assert.ok(await exists(srcPath), `${srcPath} must exist`);
    assert.ok(await exists(pubPath), `${pubPath} must exist`);

    const content = await read(srcPath);
    assert.ok(content.length > 200, `${art} must contain substantive instructions`);
    assert.match(content, /^#\s+.+/m, `${art} must have a top level header`);
  }
});

test('HelpDrawer implements search, contextual routing, articles viewer, FAQs and assistant link', async () => {
  const code = await read('src/app/features/help/components/help-drawer.ts');

  // Verify class and selector
  assert.match(code, /selector:\s*'app-help-drawer'/);
  assert.match(code, /export class HelpDrawer/);

  // Verify contextual article computation
  assert.match(code, /readonly contextualArticle = computed/);
  assert.match(code, /url\.includes\('\/ocr'\)/);
  assert.match(code, /url\.includes\('\/workflows'\)/);
  assert.match(code, /url\.includes\('\/expedient'\)/);
  assert.match(code, /url\.includes\('\/users'\)/);

  // Verify search
  assert.match(code, /readonly filteredArticles = computed/);
  assert.match(code, /readonly filteredFaqs = computed/);

  // Verify assistant integration
  assert.match(code, /connectWithAssistant/);
  assert.match(code, /assistant:open/);
});

test('login page provides a direct link to create enterprise accounts via /planes', async () => {
  const loginCode = await read('src/app/features/auth/pages/login-page.ts');
  assert.match(loginCode, /routerLink="\/planes"/);
  assert.match(loginCode, /Crear cuenta de empresa/);
});

test('pricing page collects the organization form and pays through Stripe Checkout', async () => {
  const pricingCode = await read('src/app/features/pricing/pages/pricing-page.ts');

  // Must not have under construction placeholder
  assert.doesNotMatch(pricingCode, /<app-under-construction/);

  // Organization and administrator form precede the payment
  assert.match(pricingCode, /signupForm\.companyName/);
  assert.match(pricingCode, /signupForm\.adminPassword/);

  // Real recurring payment: no card fields in the page, no simulated signup, no client-side price
  assert.match(pricingCode, /\/api\/v1\/public\/subscriptions\/checkout/);
  assert.match(pricingCode, /window\.location\.assign\(session\.url\)/);
  assert.doesNotMatch(pricingCode, /\/api\/v1\/public\/signup/);
  assert.doesNotMatch(pricingCode, /simulatedCard|amountUsd/);

  // Must have monthly and annual billing cycle toggle
  assert.match(pricingCode, /MONTHLY/);
  assert.match(pricingCode, /ANNUAL/);
});

test('Stripe return page polls the signup status instead of trusting the redirect', async () => {
  const routes = await read('src/app/features/pricing/pricing.routes.ts');
  const page = await read('src/app/features/pricing/pages/checkout-success-page.ts');
  assert.match(routes, /path: 'planes\/exito'/);
  assert.match(page, /\/api\/v1\/public\/subscriptions\/checkout\/\$\{encodeURIComponent\(sessionId\)\}\/status/);
  assert.match(page, /status !== 'COMPLETED'/);
});

test('appearance page is implemented with color presets, preview and settings PATCH', async () => {
  const appCode = await read('src/app/features/settings/pages/appearance-page.ts');
  assert.doesNotMatch(appCode, /<app-under-construction/);
  assert.match(appCode, /\/api\/v1\/tenants\/current\/settings/);
  assert.match(appCode, /themeService\.apply/);
});

test('tenant administration includes plan selector and admin credentials', async () => {
  const adminPage = await read('src/app/features/users/pages/administracion-page.ts');
  assert.match(adminPage, /tenantForm\.planId/);
  assert.match(adminPage, /tenantForm\.adminEmail/);
  assert.match(adminPage, /tenantForm\.adminName/);
  assert.match(adminPage, /\/api\/v1\/plans/);

  const apiService = await read('src/app/core/api/administration-api.service.ts');
  assert.match(apiService, /planId\?: string/);
  assert.match(apiService, /adminEmail\?: string/);
  assert.match(apiService, /adminName\?: string/);
});

test('regionalization pipes appCurrency and appDate format based on tenant settings', async () => {
  const pipeCode = await read('src/app/core/i18n/format.pipe.ts');
  assert.match(pipeCode, /name:\s*'appCurrency'/);
  assert.match(pipeCode, /name:\s*'appDate'/);
  assert.match(pipeCode, /Intl\.NumberFormat/);
  assert.match(pipeCode, /Intl\.DateTimeFormat/);
});
