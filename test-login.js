const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const p = await b.newPage();
  p.on('response', r => {
    if (r.url().includes('/api/')) console.log('API', r.status(), r.request().method(), r.url());
  });
  await p.goto('http://127.0.0.1:4200/login');
  await p.getByLabel('Organización', { exact: true }).selectOption('20000000-0000-0000-0000-000000000002');
  await p.getByLabel('Correo electrónico', { exact: true }).fill('maria@clinicacentral.test');
  await p.getByLabel('Contraseña', { exact: true }).fill('DemoPass123!');
  await p.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await p.waitForTimeout(4000);
  console.log('Current URL:', p.url());
  const errorAlert = await p.locator('.error-message, .alert, [role="alert"]').allInnerTexts();
  console.log('Alerts:', errorAlert);
  await b.close();
})().catch(e => console.error(e));
