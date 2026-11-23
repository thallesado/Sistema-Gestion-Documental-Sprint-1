const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:4200';
const TENANT_ID = '20000000-0000-0000-0000-000000000002'; // Clínica Central
const USERNAME = 'maria@clinicacentral.test';
const PASSWORD = 'DemoPass123!';

const PDF_DIR = path.resolve('synthetic-pdfs/clinica-central');

async function run() {
  console.log('--- Iniciando Población de Clínica Central en ' + BASE_URL + ' ---');
  
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  
  // Desactivar el driver tour interactivo que bloquea clicks con overlay
  await context.addInitScript(() => {
    localStorage.setItem('nexodocs_lang', 'es');
    for (let k of Object.keys(localStorage)) {
      if (k.startsWith('nexodocs.hasCompletedTour')) localStorage.setItem(k, 'true');
    }
  });

  const page = await context.newPage();

  // Función para cerrar cualquier tour de driver.js que aparezca
  async function dismissTour() {
    try {
      const skip = page.locator('.driver-popover-close-btn, .driver-close-btn');
      if (await skip.isVisible({ timeout: 500 })) {
        await skip.click();
      }
      await page.evaluate(() => {
        const overlay = document.querySelector('.driver-overlay');
        if (overlay) overlay.remove();
        const popover = document.querySelector('.driver-popover');
        if (popover) popover.remove();
      });
    } catch(e) {}
  }

  const createdData = {
    tenant: "Clínica Central",
    tenantId: TENANT_ID,
    patients: [],
    documents: [],
    expedients: [],
    workflows: [],
    physical: []
  };

  page.on('response', async (res) => {
    const url = res.url();
    const method = res.request().method();
    const status = res.status();

    if ((status === 200 || status === 201) && method === 'POST') {
      try {
        if (url.includes('/api/v1/patients') && !url.includes('/search')) {
          const body = await res.json();
          if (body && body.id && !createdData.patients.includes(body.id)) {
            console.log(' [API] Paciente capturado:', body.id);
            createdData.patients.push(body.id);
          }
        } else if (url.includes('/api/v1/documents') && !url.includes('/search') && !url.includes('/versions')) {
          const body = await res.json();
          if (body && body.id && !createdData.documents.includes(body.id)) {
            console.log(' [API] Documento capturado:', body.id);
            createdData.documents.push(body.id);
          }
        } else if (url.includes('/api/v1/expedients') && !url.includes('/search') && !url.includes('/types')) {
          const body = await res.json();
          if (body && body.id && !createdData.expedients.includes(body.id)) {
            console.log(' [API] Expediente capturado:', body.id);
            createdData.expedients.push(body.id);
          }
        } else if (url.includes('/api/v1/workflows') && !url.includes('/tasks') && !url.includes('/search') && !url.includes('/steps')) {
          const body = await res.json();
          if (body && body.id && !createdData.workflows.includes(body.id)) {
            console.log(' [API] Workflow capturado:', body.id);
            createdData.workflows.push(body.id);
          }
        } else if (url.includes('/api/v1/physical-archive/items')) {
          const body = await res.json();
          if (body && body.id && !createdData.physical.includes(body.id)) {
            console.log(' [API] Físico capturado:', body.id);
            createdData.physical.push(body.id);
          }
        }
      } catch (e) {}
    }
  });

  // 1. LOGIN
  console.log('1. Iniciando sesión como', USERNAME);
  await page.goto(BASE_URL + '/login');
  await page.getByLabel('Organización', { exact: true }).selectOption(TENANT_ID);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(USERNAME);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
  
  // Setear flag de tour para el usuario logueado
  await page.evaluate(() => {
    try {
      const user = JSON.parse(sessionStorage.getItem('nexodocs.auth_user') || '{}');
      if (user.id) localStorage.setItem('nexodocs.hasCompletedTour.' + user.id, 'true');
    } catch(e) {}
  });

  console.log('   Sesión iniciada con éxito en:', page.url());

  // 2. PACIENTES (10)
  console.log('\n2. Creando 10 Pacientes...');
  await page.goto(BASE_URL + '/clinical/patients');
  await dismissTour();
  await page.waitForSelector('button:has-text("Alta de Paciente")', { timeout: 10000 });

  const nombres = [
    ['Lucas', 'Vargas'], ['Mateo', 'Salazar'], ['Camila', 'Mendoza'], ['Valeria', 'Pinto'],
    ['Santiago', 'Rios'], ['Daniela', 'Aguilar'], ['Alejandro', 'Solis'], ['Natalia', 'Guzman'],
    ['Gabriel', 'Cabrera'], ['Mariana', 'Mercado']
  ];

  for (let i = 0; i < 10; i++) {
    const [nombre, apellido] = nombres[i];
    const docNum = '78945' + Math.floor(1000 + Math.random() * 9000);
    await dismissTour();
    await page.getByRole('button', { name: 'Alta de Paciente' }).click({ force: true });
    await page.waitForSelector('.modal-card', { state: 'visible' });

    await page.locator('select[formControlName="documentType"]').selectOption('CI');
    await page.locator('input[formControlName="documentNumber"]').fill(docNum);
    await page.locator('input[formControlName="firstName"]').fill(nombre);
    await page.locator('input[formControlName="lastName"]').fill(apellido);
    await page.locator('input[formControlName="birthDate"]').fill('1990-05-15');
    await page.locator('select[formControlName="gender"]').selectOption(i % 2 === 0 ? 'MASCULINO' : 'FEMENINO');
    await page.locator('input[formControlName="phone"]').fill('+591 765432' + (10 + i));
    await page.locator('input[formControlName="email"]').fill(nombre.toLowerCase() + '.' + apellido.toLowerCase() + docNum + '@testclinica.org');

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/patients') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Guardar Paciente' }).click()
    ]);
    
    if (response.status() === 200 || response.status() === 201) {
      console.log(`   Paciente ${i + 1}/10 creado: ${nombre} ${apellido}`);
    } else {
      console.error('Error al crear paciente', await response.text());
    }
    await page.waitForSelector('.modal-card', { state: 'hidden' });
    await page.waitForTimeout(200);
  }

  // 3. DOCUMENTOS PDF (10)
  console.log('\n3. Creando y Subiendo 10 Documentos PDF...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(BASE_URL + '/documents/upload');
    await dismissTour();
    await page.waitForSelector('form.create-form', { timeout: 10000 });

    const code = 'CC-DOC-' + Date.now().toString().slice(-4) + '-' + i;
    const title = 'Documento Clínico Central ' + i;
    const filePath = path.join(PDF_DIR, 'doc-' + i + '.pdf');

    await page.locator('input[name="documentCode"]').fill(code);
    await page.locator('input[name="documentName"]').fill(title);

    const typeSelect = page.locator('select[name="documentTypeId"]');
    const options = await typeSelect.locator('option').all();
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val !== '') {
        await typeSelect.selectOption(val);
        break;
      }
    }

    const fileInput = page.locator('input[type="file"][name="initialFile"]');
    await fileInput.setInputFiles(filePath);

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/documents') && res.request().method() === 'POST'),
      page.locator('form.create-form button[type="submit"]').click()
    ]);

    if (response.status() === 200 || response.status() === 201) {
      console.log(`   Documento ${i}/10 subido: ${code}`);
    } else {
      console.error('Error al subir documento ' + i, await response.text());
    }
    await page.waitForTimeout(300);
  }

  // 4. EXPEDIENTES (10) Y ASOCIACIÓN A PACIENTES
  console.log('\n4. Creando 10 Expedientes vinculados a Pacientes...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(BASE_URL + '/expedients/new');
    await dismissTour();
    await page.waitForSelector('input[placeholder*="EXP-"]', { timeout: 10000 });

    const expCode = 'CC-EXP-' + Date.now().toString().slice(-4) + '-' + i;
    const expName = 'Expediente Paciente Clínico ' + i;

    // Paso 1
    await page.locator('input[placeholder*="EXP-"]').fill(expCode);
    await page.locator('input[placeholder*="Alta de proveedor"]').fill(expName);

    const expTypeSelect = page.locator('select').first();
    const opts = await expTypeSelect.locator('option').all();
    for (const o of opts) {
      const v = await o.getAttribute('value');
      if (v) { await expTypeSelect.selectOption(v); break; }
    }
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2
    await page.waitForSelector('section.participants-editor', { timeout: 5000 });
    const respSelect = page.locator('select').first();
    const respOpts = await respSelect.locator('option').all();
    if (respOpts.length > 1) {
      await respSelect.selectOption({ index: 1 });
    }

    const sourceSelect = page.locator('select[aria-label="Tipo de participante"]');
    await sourceSelect.selectOption('PATIENT');
    await page.waitForTimeout(200);

    const patientSelect = page.locator('select[aria-label="Seleccionar paciente"]');
    const pOpts = await patientSelect.locator('option').all();
    if (pOpts.length > 1) {
      const selIndex = Math.min(i, pOpts.length - 1);
      await patientSelect.selectOption({ index: selIndex });
      await page.getByRole('button', { name: '＋ Añadir' }).click();
      await page.waitForTimeout(200);
    }

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3
    await page.waitForSelector('button:has-text("Crear expediente")', { timeout: 5000 });
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/expedients') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Crear expediente' }).click()
    ]);

    if (response.status() === 200 || response.status() === 201) {
      console.log(`   Expediente ${i}/10 creado: ${expCode}`);
    } else {
      console.error('Error al crear expediente ' + i, await response.text());
    }
    await page.waitForTimeout(300);
  }

  // 5. WORKFLOWS (10)
  console.log('\n5. Definiendo y Activando 10 Workflows...');
  // Crear una plantilla base si no hay ninguna
  await page.goto(BASE_URL + '/workflows/designer');
  await dismissTour();
  await page.waitForSelector('.workspace', { timeout: 10000 });
  const tplName = 'Flujo Clínico Central Base ' + Date.now();
  await page.getByRole('button', { name: /Informaci/ }).click();
  await page.locator('.wf-template-form').getByLabel('Nombre', { exact: true }).fill(tplName);
  await page.locator('.wf-template-form select').nth(1).selectOption('ACTIVE');
  await page.getByRole('button', { name: /Guardar como plantilla/ }).click();
  await page.waitForSelector('app-workflow-designer .wf-success', { timeout: 5000 });
  console.log('   Plantilla creada:', tplName);

  for (let i = 1; i <= 10; i++) {
    const wfTitle = 'Revisión Expediente Clínico #' + i;
    
    await page.goto(BASE_URL + '/workflows');
    await dismissTour();
    await page.waitForSelector('button:has-text("Iniciar workflow")', { timeout: 10000 });
    await page.getByRole('button', { name: /Iniciar workflow/ }).click();

    await page.getByRole('heading', { name: 'Seleccionar origen', exact: true }).waitFor();
    await page.getByRole('dialog').locator('select').first().selectOption('INDEPENDENT');
    await page.getByRole('dialog').getByLabel('Nombre del workflow', { exact: true }).fill(wfTitle);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await page.getByRole('heading', { name: 'Plantilla', exact: true }).waitFor();
    const tplOption = page.getByRole('dialog').locator('select option').filter({ hasText: tplName }).first();
    if (await tplOption.count()) {
      await page.getByRole('dialog').locator('select').first().selectOption(await tplOption.getAttribute('value'));
    } else {
      await page.getByRole('dialog').locator('select').first().selectOption({ index: 0 });
    }
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await page.getByRole('heading', { name: 'Responsables', exact: true }).waitFor();
    const ownId = await page.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('nexodocs.auth_user')).id; } catch(e) { return ''; }
    });
    for (const assignee of await page.getByRole('dialog').locator('select').all()) {
      if (ownId) await assignee.selectOption(ownId);
    }
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await page.getByRole('heading', { name: 'Fechas', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    await page.getByRole('heading', { name: 'Confirmación', exact: true }).waitFor();
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/v1/workflows') && res.request().method() === 'POST'),
      page.getByRole('button', { name: 'Confirmar e iniciar', exact: true }).click()
    ]);

    if (response.status() === 200 || response.status() === 201) {
      console.log(`   Workflow ${i}/10 iniciado: ${wfTitle}`);
    } else {
      console.error('Error al iniciar workflow ' + i, await response.text());
    }
    await page.waitForTimeout(300);
  }

  // 6. ARCHIVO FÍSICO (10 ORIGINALES)
  console.log('\n6. Registrando 10 Originales Físicos...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(BASE_URL + '/physical-archive');
    await dismissTour();
    await page.waitForSelector('button:has-text("Registrar original")', { timeout: 10000 });
    await page.getByRole('button', { name: 'Registrar original', exact: true }).click({ force: true });

    const editor = page.locator('dialog[open]');
    await editor.waitFor({ state: 'visible' });

    const code = 'BARCODE-CC-' + Date.now().toString().slice(-4) + '-' + i;
    const name = 'Historia Clínica Física Archivo ' + i;

    await editor.locator('[name=code]').fill(code);
    await editor.locator('[name=name]').fill(name);
    await editor.locator('[name=loc]').selectOption({ index: 1 });
    
    const custSelect = editor.locator('[name=custodian]');
    const custOpts = await custSelect.locator('option').all();
    if (custOpts.length > 1) {
      await custSelect.selectOption({ index: 1 });
    }

    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().endsWith('/api/v1/physical-archive/items') && res.request().method() === 'POST'),
      editor.locator('button.primary').click()
    ]);

    if (response.status() === 200 || response.status() === 201) {
      console.log(`   Físico ${i}/10 registrado: ${code}`);
    } else {
      console.error('Error al registrar físico ' + i, await response.text());
    }
    await page.waitForTimeout(300);
  }

  // Guardar resultados en data-clinica-central.json
  const outputFile = path.resolve('data-clinica-central.json');
  fs.writeFileSync(outputFile, JSON.stringify(createdData, null, 2), 'utf8');
  console.log('\n=== Resultados guardados con éxito en:', outputFile);
  console.log('Resumen de IDs capturados:');
  console.log(' - Pacientes:', createdData.patients.length);
  console.log(' - Documentos:', createdData.documents.length);
  console.log(' - Expedientes:', createdData.expedients.length);
  console.log(' - Workflows:', createdData.workflows.length);
  console.log(' - Físicos:', createdData.physical.length);

  await browser.close();
}

run().catch(err => {
  console.error('Error en ejecución:', err);
  process.exit(1);
});
