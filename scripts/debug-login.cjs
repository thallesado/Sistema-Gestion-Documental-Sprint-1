const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const page = await browser.newPage();
  page.on('response', async res => {
    if (res.url().includes('login') || res.url().includes('auth')) {
      console.log('RES:', res.status(), res.url(), (await res.text().catch(()=>'')).slice(0, 150));
    }
  });
  await page.goto('http://127.0.0.1:4200/login');
  await page.waitForTimeout(500);
  await page.locator('select[name="tenantId"]').selectOption('2ff78cc6-de74-4e18-b5b1-fff9c313f1c0');
  await page.locator('input[name="usernameOrEmail"]').fill('admin@farmacorp.test');
  await page.locator('input[name="password"]').fill('DemoPass123!');
  console.log('CLICKING LOGIN BUTTON...');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForTimeout(3000);
  console.log('CURRENT URL:', page.url());
  const errorAlert = await page.locator('.alert-danger, .error-message, .error-feedback, [role="alert"]').allInnerTexts();
  console.log('ERROR ALERTS:', errorAlert);
  await browser.close();
})();
