const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const FINOCODE_TENANT_ID = '20000000-0000-0000-0000-000000000001';
const USERNAME = 'laura@acme.com';
const PASSWORD = 'DemoPass123!';

const PDF_DIR = path.resolve('synthetic-pdfs/finocode');

async function run() {
  console.log('=====================================================');
  console.log('Iniciando poblamiento de tenant FinoCode en ' + BASE_URL);
  console.log('Tenant ID:', FINOCODE_TENANT_ID);
  console.log('Usuario:', USERNAME);
  console.log('=====================================================');

  const chromePath = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1254', 'chrome-win64', 'chrome.exe');
  const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : (fs.existsSync(edgePath) ? edgePath : undefined);

  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  // Desactivar tours interactivos y overlays de driver.js
  await context.addInitScript(() => {
    localStorage.setItem('nexodocs_lang', 'es');
    localStorage.setItem('nexodocs.tourCompleted', 'true');
    for (let k of Object.keys(localStorage)) {
      if (k.startsWith('nexodocs.hasCompletedTour')) localStorage.setItem(k, 'true');
    }
    const style = document.createElement('style');
    style.innerHTML = `
      .driver-overlay, .driver-popover, #driver-highlighted-element-stage {
        display: none !important;
        pointer-events: none !important;
        visibility: hidden !important;
      }
    `;
    document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });

  const page = await context.newPage();

  async function dismissTour() {
    try {
      await page.evaluate(() => {
        document.querySelectorAll('.driver-overlay, .driver-popover').forEach(el => el.remove());
      });
    } catch (e) {}
  }

  const resultData = {
    tenant: 'FinoCode',
    patients: [],
    documents: [],
    expedients: [],
    workflows: [],
    physical: []
  };

  // Interceptar respuestas HTTP 200/201 para recolectar IDs
  page.on('response', async (res) => {
    const url = res.url();
    const method = res.request().method();
    const status = res.status();

    if ((status === 200 || status === 201) && method === 'POST') {
      try {
        if (url.includes('/api/v1/patients') && !url.includes('/search')) {
          const body = await res.json();
          if (body && body.id && !resultData.patients.includes(body.id)) {
            console.log(' [API Paciente] Capturado ID:', body.id);
            resultData.patients.push(body.id);
          }
        } else if (url.includes('/api/v1/documents') && !url.includes('/search') && !url.includes('/versions')) {
          const body = await res.json();
          if (body && body.id && !resultData.documents.includes(body.id)) {
            console.log(' [API Documento] Capturado ID:', body.id);
            resultData.documents.push(body.id);
          }
        } else if (url.includes('/api/v1/expedients') && !url.includes('/search') && !url.includes('/types')) {
          const body = await res.json();
          if (body && body.id && !resultData.expedients.includes(body.id)) {
            console.log(' [API Expediente] Capturado ID:', body.id);
            resultData.expedients.push(body.id);
          }
        } else if (url.includes('/api/v1/workflows') && !url.includes('/tasks') && !url.includes('/search') && !url.includes('/steps')) {
          const body = await res.json();
          if (body && body.id && !resultData.workflows.includes(body.id)) {
            console.log(' [API Workflow] Capturado ID:', body.id);
            resultData.workflows.push(body.id);
          }
        } else if (url.includes('/api/v1/physical-archive/items')) {
          const body = await res.json();
          if (body && body.id && !resultData.physical.includes(body.id)) {
            console.log(' [API Archivo Físico] Capturado ID:', body.id);
            resultData.physical.push(body.id);
          }
        }
      } catch (e) {}
    }
  });

  // 1. LOGIN
  console.log('\n[1/6] Iniciando sesión en UI:', `${BASE_URL}/login?tenant=${FINOCODE_TENANT_ID}`);
  await page.goto(`${BASE_URL}/login?tenant=${FINOCODE_TENANT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  await page.locator('#email-input').fill(USERNAME);
  await page.locator('#password-input').fill(PASSWORD);
  await page.locator('button.submit-btn').first().click();

  await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 20000 });
  await page.waitForTimeout(1000);

  // Setear flags de tour en localStorage
  await page.evaluate(() => {
    try {
      const user = JSON.parse(sessionStorage.getItem('nexodocs.auth_user') || '{}');
      if (user.id) {
        localStorage.setItem('nexodocs.hasCompletedTour.' + user.id, 'true');
        localStorage.setItem('nexodocs.tourCompleted', 'true');
      }
    } catch (e) {}
  });

  console.log('✓ Sesión iniciada con éxito en:', page.url());

  // 2. PACIENTES (10)
  console.log('\n[2/6] Creando 10 Pacientes en /clinical/patients...');
  await page.goto(`${BASE_URL}/clinical/patients`, { waitUntil: 'networkidle' });
  await dismissTour();
  await page.waitForSelector('button:has-text("Alta de Paciente")', { timeout: 15000 });

  const patientNames = [
    ['Lucas', 'Mendoza'], ['Camila', 'Vargas'], ['Ignacio', 'Rios'], ['Daniela', 'Serrano'],
    ['Joaquín', 'Alvarez'], ['Natalia', 'Paz'], ['Gonzalo', 'Miranda'], ['Valeria', 'Salazar'],
    ['Emilio', 'Guzmán'], ['Mariana', 'Ortiz']
  ];

  for (let i = 0; i < 10; i++) {
    const [nombre, apellido] = patientNames[i];
    const docNum = 'CI-FC-' + Date.now().toString().slice(-5) + '-' + (i + 1);

    await dismissTour();
    await page.getByRole('button', { name: 'Alta de Paciente' }).click({ force: true });
    await page.waitForSelector('.modal-card', { state: 'visible' });

    await page.locator('.modal-card select').first().selectOption('CI');
    await page.locator('.modal-card input[placeholder*="6849201"]').fill(docNum);
    await page.locator('.modal-card input[placeholder*="Juan Carlos"]').fill(nombre);
    await page.locator('.modal-card input[placeholder*="Pérez Gómez"]').fill(apellido);

    const [createRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/patients') && r.request().method() === 'POST', { timeout: 15000 }),
      page.locator('.modal-card form').dispatchEvent('submit')
    ]);

    const status = createRes.status();
    if (status === 200 || status === 201) {
      console.log(`   Paciente ${i + 1}/10 creado: ${nombre} ${apellido} (${docNum})`);
    } else {
      console.error(`   Error al crear paciente ${i + 1}: status ${status}`);
    }

    await page.waitForSelector('.modal-card', { state: 'hidden', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  // 3. DOCUMENTOS CON PDF (10)
  console.log('\n[3/6] Subiendo 10 Documentos PDF en /documents/upload...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/documents/upload`, { waitUntil: 'networkidle' });
    await dismissTour();
    await page.waitForSelector('form.create-form', { timeout: 15000 });

    const code = `DOC-FC-SYNTH-${Date.now().toString().slice(-4)}-${i}`;
    const title = `Documento Sintético FinoCode #${i}`;
    const filePath = path.join(PDF_DIR, `documento-sintetico-${i}.pdf`);

    await page.locator('input[placeholder*="DOC-"], input[name="code"]').first().fill(code);
    await page.locator('input[placeholder*="nombre"], input[placeholder*="Título"], input[name="title"], input[name="name"]').first().fill(title);

    // Tipo de documento
    const typeSelect = page.locator('form select').first();
    const options = await typeSelect.locator('option').all();
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val && val !== '') {
        await typeSelect.selectOption(val);
        break;
      }
    }

    // Seleccionar archivo PDF sintético
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
    await page.waitForTimeout(500);

    const [docRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/documents') && r.request().method() === 'POST', { timeout: 20000 }),
      page.getByRole('button', { name: /Crear y subir versión v1|Crear documento|Subir/i }).click()
    ]);

    const status = docRes.status();
    if (status === 200 || status === 201) {
      console.log(`   Documento ${i}/10 subido: ${code} (${path.basename(filePath)})`);
    } else {
      console.error(`   Error al crear documento ${i}: status ${status}`, await docRes.text());
    }

    // Esperar a que la versión termine si dispara llamada secundaria
    await page.waitForTimeout(500);
  }

  // 4. EXPEDIENTES (10) VINCULADOS A PACIENTES
  console.log('\n[4/6] Creando 10 Expedientes en /expedients/new asociados a Pacientes...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/expedients/new`, { waitUntil: 'networkidle' });
    await dismissTour();
    await page.waitForSelector('input[placeholder*="EXP-"]', { timeout: 15000 });

    const expCode = `EXP-FC-${Date.now().toString().slice(-4)}-${i}`;
    const expName = `Expediente Paciente FinoCode #${i}`;

    // Paso 1: Información básica
    await page.locator('input[placeholder*="EXP-"]').fill(expCode);
    await page.locator('input[placeholder*="Alta de proveedor"]').fill(expName);

    const expTypeSelect = page.locator('select').first();
    const expOpts = await expTypeSelect.locator('option').all();
    for (const opt of expOpts) {
      const val = await opt.getAttribute('value');
      if (val && val !== '') {
        await expTypeSelect.selectOption(val);
        break;
      }
    }

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 2: Asociar participante paciente
    await page.waitForSelector('select[aria-label="Tipo de participante"]', { timeout: 8000 });
    const sourceSelect = page.locator('select[aria-label="Tipo de participante"]');
    await sourceSelect.selectOption('PATIENT');
    await page.waitForTimeout(300);

    const patientSelect = page.locator('select[aria-label="Seleccionar paciente"]');
    const pOpts = await patientSelect.locator('option').all();
    if (pOpts.length > 1) {
      const selIndex = Math.min(i, pOpts.length - 1);
      await patientSelect.selectOption({ index: selIndex });
      await page.getByRole('button', { name: '＋ Añadir' }).click();
      await page.waitForTimeout(300);
    }

    await page.getByRole('button', { name: 'Continuar' }).click();

    // Paso 3: Confirmación y creación
    await page.waitForSelector('button:has-text("Crear expediente")', { timeout: 8000 });
    const [expRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/expedients') && r.request().method() === 'POST', { timeout: 20000 }),
      page.getByRole('button', { name: 'Crear expediente' }).click()
    ]);

    const status = expRes.status();
    if (status === 200 || status === 201) {
      console.log(`   Expediente ${i}/10 creado: ${expCode}`);
    } else {
      console.error(`   Error al crear expediente ${i}: status ${status}`);
    }
    await page.waitForTimeout(300);
  }

  // 5. WORKFLOWS (10)
  console.log('\n[5/6] Definiendo y Activando 10 Workflows en /workflows/designer y /workflows...');
  // 5.1 Crear plantilla en Diseñador
  await page.goto(`${BASE_URL}/workflows/designer`, { waitUntil: 'networkidle' });
  await dismissTour();
  await page.waitForSelector('.workspace', { timeout: 15000 });

  const tplName = `Flujo Aprobación FinoCode ${Date.now().toString().slice(-4)}`;
  await page.getByRole('button', { name: /Informaci/ }).click();
  await page.locator('.wf-template-form').getByLabel('Nombre', { exact: true }).fill(tplName);
  await page.locator('.wf-template-form select').nth(1).selectOption('ACTIVE');
  await page.getByRole('button', { name: /Guardar como plantilla/ }).click();
  await page.waitForSelector('app-workflow-designer .wf-success', { timeout: 8000 }).catch(() => {});
  console.log('   Plantilla creada en diseñador:', tplName);

  // 5.2 Iniciar 10 instancias activas
  for (let i = 1; i <= 10; i++) {
    const wfTitle = `Flujo Operativo FinoCode #${i}`;

    await page.goto(`${BASE_URL}/workflows`, { waitUntil: 'networkidle' });
    await dismissTour();
    await page.waitForSelector('button:has-text("Iniciar workflow")', { timeout: 15000 });
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
      try { return JSON.parse(sessionStorage.getItem('nexodocs.auth_user')).id; } catch (e) { return ''; }
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
    const [wfRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/workflows') && r.request().method() === 'POST', { timeout: 20000 }),
      page.getByRole('button', { name: 'Confirmar e iniciar', exact: true }).click()
    ]);

    const status = wfRes.status();
    if (status === 200 || status === 201) {
      console.log(`   Workflow ${i}/10 iniciado: ${wfTitle}`);
    } else {
      console.error(`   Error al iniciar workflow ${i}: status ${status}`);
    }
    await page.waitForTimeout(300);
  }

  // 6. ARCHIVO FÍSICO (10)
  console.log('\n[6/6] Registrando 10 Originales Físicos en /physical-archive...');
  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/physical-archive`, { waitUntil: 'networkidle' });
    await dismissTour();
    await page.waitForSelector('button:has-text("Registrar original")', { timeout: 15000 });
    await page.getByRole('button', { name: 'Registrar original', exact: true }).click({ force: true });

    const editor = page.locator('dialog[open]');
    await editor.waitFor({ state: 'visible' });

    const code = `BARCODE-FC-${Date.now().toString().slice(-4)}-${i}`;
    const name = `Legajo Físico Original FinoCode #${i}`;

    await editor.locator('[name=code]').fill(code);
    await editor.locator('[name=name]').fill(name);
    await editor.locator('[name=loc]').selectOption({ index: 1 });

    const custSelect = editor.locator('[name=custodian]');
    const custOpts = await custSelect.locator('option').all();
    if (custOpts.length > 1) {
      await custSelect.selectOption({ index: 1 });
    }

    const [physRes] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/v1/physical-archive/items') && r.request().method() === 'POST', { timeout: 20000 }),
      editor.locator('button.primary').click()
    ]);

    const status = physRes.status();
    if (status === 200 || status === 201) {
      console.log(`   Físico ${i}/10 registrado: ${code}`);
    } else {
      console.error(`   Error al registrar original físico ${i}: status ${status}`);
    }
    await page.waitForTimeout(300);
  }

  // Guardar resultados en data-finocode.json
  const outputFile = path.resolve('data-finocode.json');
  fs.writeFileSync(outputFile, JSON.stringify(resultData, null, 2), 'utf8');

  console.log('\n=====================================================');
  console.log('✓ Proceso completado exitosamente.');
  console.log('Archivo de resultados guardado en:', outputFile);
  console.log('Resumen de IDs capturados:');
  console.log(' - Pacientes:', resultData.patients.length);
  console.log(' - Documentos:', resultData.documents.length);
  console.log(' - Expedientes:', resultData.expedients.length);
  console.log(' - Workflows:', resultData.workflows.length);
  console.log(' - Físicos:', resultData.physical.length);
  console.log('=====================================================');

  await browser.close();
}

run().catch(err => {
  console.error('[ERROR FATAL en populate-finocode]', err);
  process.exit(1);
});
