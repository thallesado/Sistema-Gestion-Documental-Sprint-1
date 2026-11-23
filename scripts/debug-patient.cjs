const fs = require('fs'), path = require('path');
const pw = require(fs.readFileSync(path.join(process.env.LOCALAPPDATA, 'ms-playwright', '.links', fs.readdirSync(path.join(process.env.LOCALAPPDATA, 'ms-playwright', '.links'))[0]), 'utf8').trim());

async function debugPatient() {
  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1254', 'chrome-win64', 'chrome.exe')
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('request', req => {
    if (req.url().includes('/api/v1/patients')) {
      console.log('PATIENT REQUEST:', req.method(), req.url(), req.postData());
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/api/v1/patients')) {
      console.log('PATIENT RESPONSE:', res.status(), await res.text());
    }
  });

  await page.goto('http://localhost:4200/login?tenant=20000000-0000-0000-0000-000000000001', { waitUntil: 'networkidle' });
  await page.locator('#email-input').fill('laura@acme.com');
  await page.locator('#password-input').fill('DemoPass123!');
  await page.locator('button.submit-btn').click();
  await page.waitForTimeout(1500);

  console.log('Current URL after login:', page.url());
  await page.goto('http://localhost:4200/clinical/patients', { waitUntil: 'networkidle' });
  console.log('Arrived at patients page:', page.url());

  const openBtn = page.getByRole('button', { name: 'Alta de Paciente' });
  console.log('Open button count:', await openBtn.count());
  await openBtn.click();
  await page.waitForTimeout(500);

  const modal = page.locator('.modal-backdrop');
  console.log('Modal visible:', await modal.isVisible());

  await page.locator('select[formcontrolname="documentType"]').selectOption('CI');
  await page.locator('input[formcontrolname="documentNumber"]').fill('12345678');
  await page.locator('input[formcontrolname="firstName"]').fill('Juan');
  await page.locator('input[formcontrolname="lastName"]').fill('Perez');

  const submitBtn = page.locator('.modal-footer button.primary-btn');
  console.log('Submit button disabled:', await submitBtn.isDisabled());
  console.log('Submit button text:', await submitBtn.innerText());

  await submitBtn.click();
  await page.waitForTimeout(2000);
  await browser.close();
}
debugPatient().catch(console.error);
