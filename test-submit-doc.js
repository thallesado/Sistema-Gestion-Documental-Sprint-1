const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('response', r => {
    if (r.url().includes('/api/')) console.log('API', r.status(), r.request().method(), r.url());
  });
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

  await p.locator('input[type="file"][name="initialFile"]').setInputFiles(path.resolve('synthetic-pdfs/clinica-central/doc-1.pdf'));
  await p.waitForTimeout(500);

  const submitBtn = p.locator('form.create-form button[type="submit"]');
  console.log('Clicking submit...');
  await submitBtn.click();
  await p.waitForTimeout(3000);

  const notices = await p.locator('.notice').allInnerTexts();
  console.log('Notices:', notices);
  await b.close();
})().catch(e => console.error(e));
