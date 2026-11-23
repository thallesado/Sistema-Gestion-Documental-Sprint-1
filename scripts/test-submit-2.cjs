const fs = require('fs'), path = require('path');
const pw = require(fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'ms-playwright', '.links', fs.readdirSync(path.join(process.env.LOCALAPPDATA, 'ms-playwright', '.links'))[0]), 'utf8').trim());

async function testSubmit() {
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1254', 'chrome-win64', 'chrome.exe')
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', m => console.log('LOG:', m.text()));

  await page.goto('http://localhost:4200/login?tenant=20000000-0000-0000-0000-000000000001', { waitUntil: 'networkidle' });
  await page.locator('#email-input').fill('laura@acme.com');
  await page.locator('#password-input').fill('DemoPass123!');
  await page.locator('button.submit-btn').click();
  await page.waitForTimeout(1500);

  await page.goto('http://localhost:4200/clinical/patients', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Alta de Paciente' }).click();
  await page.locator('.modal-backdrop').waitFor({ state: 'visible' });

  // Rellenar campos usando selectores exactos con getByPlaceholder
  await page.locator('.modal-card select').first().selectOption('CI');
  await page.locator('.modal-card input[placeholder*="6849201"]').fill('TEST-PW-' + Date.now().toString().slice(-4));
  await page.locator('.modal-card input[placeholder*="Juan Carlos"]').fill('Juan Carlos');
  await page.locator('.modal-card input[placeholder*="Pérez Gómez"]').fill('Perez Gomez');

  await page.waitForTimeout(500);

  const resPromise = page.waitForResponse(r => r.url().includes('/api/v1/patients') && r.request().method() === 'POST', { timeout: 10000 });
  await page.locator('.modal-card form').dispatchEvent('submit');
  const res = await resPromise;

  console.log('Result status:', res.status(), await res.json());
  await browser.close();
}
testSubmit().catch(console.error);
