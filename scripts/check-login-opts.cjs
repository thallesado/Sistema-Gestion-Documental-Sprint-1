const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4200/login');
  await page.waitForTimeout(1000);
  const opts = await page.locator('select[name="tenantId"]').locator('option').all();
  for (let o of opts) {
    console.log('OPT:', await o.getAttribute('value'), '-->', await o.innerText());
  }
  await browser.close();
})();
