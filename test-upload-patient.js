const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto('http://localhost:4200/login');
  await p.getByLabel('Organización', { exact: true }).selectOption('20000000-0000-0000-0000-000000000002');
  await p.getByLabel('Correo electrónico', { exact: true }).fill('maria@clinicacentral.test');
  await p.getByLabel('Contraseña', { exact: true }).fill('DemoPass123!');
  await p.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await p.waitForURL(url => !url.pathname.includes('/login'));

  await p.goto('http://localhost:4200/documents/upload');
  await p.waitForSelector('form.create-form');

  await p.locator('input[name="documentCode"]').fill('DOC-TEST-99');
  await p.locator('input[name="documentName"]').fill('Documento Test Subida');

  const typeSelect = p.locator('select[name="documentTypeId"]');
  const opts = await typeSelect.locator('option').all();
  for (const opt of opts) {
    const val = await opt.getAttribute('value');
    if (val) {
      await typeSelect.selectOption(val);
      break;
    }
  }

  // Paciente asociado
  const patientSelect = p.locator('select[name="patientId"]');
  const pOpts = await patientSelect.locator('option').all();
  if (pOpts.length > 1) {
    await patientSelect.selectOption({ index: 1 });
  }

  // Metadatos dinámicos del form si hay
  const metaInputs = await p.locator('input[placeholder*="patient"], input[name*="patient"], select[name*="patient"]').all();
  for (const mi of metaInputs) {
    try { await mi.fill('Paciente Test'); } catch(e) {}
  }

  await p.locator('input[type="file"][name="initialFile"]').setInputFiles(path.resolve('synthetic-pdfs/clinica-central/doc-1.pdf'));
  await p.waitForTimeout(500);

  const [response] = await Promise.all([
    p.waitForResponse(res => res.url().includes('/api/v1/documents') && res.request().method() === 'POST'),
    p.locator('form.create-form button[type="submit"]').click()
  ]);

  console.log('Document POST response:', response.status(), await response.text());
  await b.close();
})().catch(e => console.error(e));
