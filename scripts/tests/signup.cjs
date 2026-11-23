const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { launchBrowser, createContext } = require('./common.cjs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const DEFAULT_PASSWORD = 'DemoLocal2026!';

const ORGANIZATIONS = [
  {
    name: 'Clínica Foianini Demo',
    adminName: 'Super Admin Foianini',
    email: 'admin.foianini@demo.local',
    password: DEFAULT_PASSWORD,
    plan: 'BASIC'
  },
  {
    name: 'Farmacorp Demo',
    adminName: 'Super Admin Farmacorp',
    email: 'admin.farmacorp@demo.local',
    password: DEFAULT_PASSWORD,
    plan: 'BASIC'
  }
];

async function registerTenant(page, org) {
  console.log(`\n========================================`);
  console.log(`[ALTA] Registrando organización: "${org.name}"...`);
  console.log(`[ALTA] Email: ${org.email} | Plan: ${org.plan}`);

  await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });

  // Asegurar plan BASIC (o el indicado)
  const planButton = page.locator(`.switch button:has-text("${org.plan}")`);
  if (await planButton.count() > 0) {
    await planButton.click();
  }

  // Rellenar formulario de alta pública gratuita
  await page.locator('input[name="tenantName"]').fill(org.name);
  await page.locator('input[name="administratorName"]').fill(org.adminName);
  await page.locator('input[name="demoEmail"]').fill(org.email);
  await page.locator('input[name="demoPassword"]').fill(org.password);
  await page.locator('input[name="confirmDemoPassword"]').fill(org.password);

  console.log(`[ALTA] Formulario completado. Enviando solicitud de onboarding...`);

  // Interceptar la respuesta del endpoint de onboarding
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/v1/public/onboarding') && res.request().method() === 'POST', { timeout: 180000 }),
    page.locator('button.submit').click()
  ]);

  const statusCode = response.status();
  const responseBody = await response.json();

  console.log(`[ALTA] Respuesta onboarding status: ${statusCode}`);
  assert.equal(statusCode, 200, `Error en alta: status ${statusCode} - ${JSON.stringify(responseBody)}`);

  // Extraer token y tenantId
  const token = responseBody.token;
  assert(token, 'El onboarding no retornó token JWT');
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
  const tenantId = payload.tenantId || responseBody.tenantId;
  const userId = payload.userId || responseBody.userId;

  console.log(`[ALTA] Tenant creado con éxito!`);
  console.log(`[ALTA] Tenant ID: ${tenantId}`);
  console.log(`[ALTA] User ID: ${userId}`);

  // Esperar confirmación visual de éxito o redirección
  await page.waitForTimeout(2000);

  return {
    name: org.name,
    tenantId: tenantId,
    adminEmail: org.email,
    adminUsername: payload.sub || org.email,
    userId: userId,
    status: 'ACTIVE',
    plan: org.plan,
    token: token
  };
}

async function verifyLogin(page, orgRecord, password) {
  console.log(`\n[VERIFICACIÓN] Verificando inicio de sesión para "${orgRecord.name}" en ${BASE_URL}/login...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  // Seleccionar la organización en el selector si está presente
  const tenantSelect = page.locator('#tenant-input');
  await tenantSelect.waitFor({ state: 'attached' });

  // Esperar a que las opciones carguen
  await page.waitForFunction((id) => {
    const sel = document.querySelector('#tenant-input');
    if (!sel) return false;
    for (const opt of sel.options) {
      if (opt.value === id) return true;
    }
    return false;
  }, orgRecord.tenantId, { timeout: 10000 }).catch(() => {
    console.log(`[VERIFICACIÓN] Nota: el option con tenantId exacto no cargó inmediatamente en el select; intentando por nombre o directo.`);
  });

  // Intentar seleccionar por value (tenantId)
  try {
    await tenantSelect.selectOption({ value: orgRecord.tenantId });
  } catch {
    // Si no coincide por value exacto, buscar por texto
    try {
      await tenantSelect.selectOption({ label: orgRecord.name });
    } catch {
      console.log(`[VERIFICACIÓN] Dejando selector o probando sin selección directa.`);
    }
  }

  // Rellenar credenciales
  await page.locator('#email-input').fill(orgRecord.adminEmail);
  await page.locator('#password-input').fill(password);

  // Enviar login
  const [loginRes] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST', { timeout: 15000 }),
    page.locator('button[type="submit"].submit-btn, button.submit-btn, button:has-text("Iniciar Sesión")').first().click()
  ]);

  const status = loginRes.status();
  const body = await loginRes.json();
  console.log(`[VERIFICACIÓN] Respuesta login: status ${status}`);
  assert.equal(status, 200, `Fallo login para ${orgRecord.adminEmail}: ${JSON.stringify(body)}`);
  assert(body.token, 'Respuesta de login no contiene token');

  console.log(`[VERIFICACIÓN] Super-admin autenticado exitosamente en UI.`);
}

async function main() {
  console.log('Iniciando automatización de creación de tenants...');
  const browser = await launchBrowser({ headless: true });
  const context = await createContext(browser);
  const page = await context.newPage();

  const createdTenants = [];

  try {
    for (const org of ORGANIZATIONS) {
      // 1. Alta pública
      const record = await registerTenant(page, org);
      createdTenants.push(record);

      // 2. Limpiar contexto de almacenamiento
      await context.clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // 3. Verificar login
      await verifyLogin(page, record, org.password);

      // Limpiar cookies y storage para la siguiente organización
      await context.clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }

    // 4. Guardar archivo created-tenants.json
    const outputPath = path.resolve('created-tenants.json');
    const sanitizedOutput = createdTenants.map(t => ({
      name: t.name,
      tenantId: t.tenantId,
      adminEmail: t.adminEmail,
      adminUsername: t.adminUsername,
      userId: t.userId,
      status: t.status,
      plan: t.plan,
      createdAt: new Date().toISOString()
    }));

    fs.writeFileSync(outputPath, JSON.stringify(sanitizedOutput, null, 2), 'utf8');
    console.log(`\n========================================`);
    console.log(`[ÉXITO] Tenants creados y verificados guardados en: ${outputPath}`);
    console.log(JSON.stringify(sanitizedOutput, null, 2));

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
