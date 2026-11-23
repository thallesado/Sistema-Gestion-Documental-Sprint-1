const { chromium } = require('playwright');
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

  await p.goto('http://localhost:4200/clinical/patients');
  await p.waitForSelector('button:has-text("Alta de Paciente")');
  await p.getByRole('button', { name: 'Alta de Paciente' }).click({ force: true });
  await p.waitForSelector('.modal-card');

  await p.locator('select[formControlName="documentType"]').selectOption('CI');
  await p.locator('input[formControlName="documentNumber"]').fill('99887766');
  await p.locator('input[formControlName="firstName"]').fill('Prueba');
  await p.locator('input[formControlName="lastName"]').fill('Test');
  
  const submitBtn = p.getByRole('button', { name: 'Guardar Paciente' });
  console.log('Is disabled?', await submitBtn.isDisabled());
  console.log('Button text:', await submitBtn.innerText());
  
  const formValues = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('.modal-card input, .modal-card select'));
    return inputs.map(i => ({ name: i.getAttribute('formcontrolname'), val: i.value }));
  });
  console.log('Inputs in form:', formValues);
  await b.close();
})().catch(e => console.error(e));
