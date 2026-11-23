const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';
const FARMACORP_TENANT_ID = '2ff78cc6-de74-4e18-b5b1-fff9c313f1c0';
const FARMACORP_USER = 'admin@farmacorp.test';
const FARMACORP_PASS = 'DemoPass123!';

const resultData = {
  tenant: 'Farmacorp Demo',
  patients: [],
  documents: [],
  expedients: [],
  workflows: [],
  physical: []
};

async function login(page) {
  console.log(`[LOGIN] Navegando a ${BASE_URL}/login?tenant=${FARMACORP_TENANT_ID}...`);
  await page.goto(`${BASE_URL}/login?tenant=${FARMACORP_TENANT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.locator('#email-input, input[name="usernameOrEmail"]').first().fill(FARMACORP_USER);
  await page.locator('#password-input, input[name="password"]').first().fill(FARMACORP_PASS);

  const [loginRes] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/v1/auth/login') && r.request().method() === 'POST', { timeout: 20000 }),
    page.locator('button.submit-btn, button[type="submit"]').first().click()
  ]);

  const status = loginRes.status();
  const body = await loginRes.json();
  assert.equal(status, 200, `Login falló: ${JSON.stringify(body)}`);
  console.log(`[LOGIN] Sesión iniciada con éxito para ${FARMACORP_USER}`);

  // Configurar bypass de tour en localStorage para este usuario
  const token = body.token || body.accessToken;
  const userId = body.userId || (token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8')).userId : 'admin');
  await page.evaluate((uid) => {
    localStorage.setItem('nexodocs.hasCompletedTour.' + uid, 'true');
    localStorage.setItem('nexodocs.tourCompleted', 'true');
  }, userId);

  await page.waitForTimeout(1000);
}

async function populatePatients(page) {
  console.log(`\n========================================`);
  console.log(`[PACIENTES] Creando 10 pacientes en /clinical/patients...`);
  await page.goto(`${BASE_URL}/clinical/patients`, { waitUntil: 'networkidle' });

  for (let i = 1; i <= 10; i++) {
    const docNum = `CI-FC-${Date.now().toString().slice(-6)}-${i}`;
    const firstName = `PacienteFarmacorp${i}`;
    const lastName = `SaludPrueba${i}`;

    // Abrir modal
    const openBtn = page.getByRole('button', { name: 'Alta de Paciente' }).or(page.locator('button:has-text("Alta de Paciente")'));
    await openBtn.first().click();

    const modal = page.locator('.modal-backdrop, .modal-card');
    await modal.first().waitFor({ state: 'visible' });

    await page.locator('.modal-card select').first().selectOption('CI');
    await page.locator('.modal-card input[placeholder*="6849201"]').fill(docNum);
    await page.locator('.modal-card input[placeholder*="Juan Carlos"]').fill(firstName);
    await page.locator('.modal-card input[placeholder*="Pérez Gómez"]').fill(lastName);

    await page.waitForTimeout(300);

    const [createRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/patients') && r.request().method() === 'POST', { timeout: 15000 }),
      page.locator('.modal-card form').dispatchEvent('submit')
    ]);

    const status = createRes.status();
    const patientData = await createRes.json();
    assert([200, 201].includes(status), `Error al crear paciente ${i}: status ${status}`);
    console.log(`[PACIENTES] (${i}/10) Creado: ${patientData.id} - ${firstName} ${lastName} (${docNum})`);
    resultData.patients.push(patientData.id);

    await page.waitForTimeout(500);
  }
}

async function populateDocuments(page) {
  console.log(`\n========================================`);
  console.log(`[DOCUMENTOS] Subiendo 10 documentos PDF en /documents/upload...`);

  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/documents/upload`, { waitUntil: 'networkidle' });

    const docCode = `DOC-FARM-${Date.now().toString().slice(-6)}-${i}`;
    const docName = `Certificado Farmacéutico Farmacorp ${i}`;
    const pdfPath = path.resolve(`synthetic-pdfs/farmacorp/farmacorp-doc-${String(i).padStart(2, '0')}.pdf`);

    await page.locator('input[name="documentName"]').fill(docName);
    await page.locator('input[name="documentCode"]').fill(docCode);

    // Tipo documental
    const typeSelect = page.locator('select[name="documentTypeId"]');
    await typeSelect.selectOption({ index: 1 });

    // Servicio / Departamento
    const deptSelect = page.locator('select[name="departmentId"]');
    if (await deptSelect.count() > 0 && (await deptSelect.locator('option').count()) > 1) {
      await deptSelect.selectOption({ index: 1 });
    }

    // Metadatos
    const supplierInput = page.locator('input[name="metadata-supplier"]');
    if (await supplierInput.count() > 0) {
      await supplierInput.fill(`Laboratorio Farmacorp ${i}`);
    }
    const dateInput = page.locator('input[name="metadata-effectiveDate"]');
    if (await dateInput.count() > 0) {
      await dateInput.fill('2026-11-23');
    }

    // Archivo
    const fileInput = page.locator('input[type="file"][name="initialFile"]');
    await fileInput.setInputFiles(pdfPath);

    await page.waitForTimeout(300);

    const [docRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/documents') && r.request().method() === 'POST', { timeout: 20000 }),
      page.locator('form.create-form').dispatchEvent('submit')
    ]);

    const status = docRes.status();
    const docData = await docRes.json();
    assert([200, 201].includes(status), `Error al crear documento ${i}: status ${status}`);
    console.log(`[DOCUMENTOS] (${i}/10) Creado: ${docData.id} - ${docCode}`);
    resultData.documents.push(docData.id);

    await page.waitForTimeout(500);
  }
}

async function populateExpedients(page) {
  console.log(`\n========================================`);
  console.log(`[EXPEDIENTES] Creando 10 expedientes en /expedients/new y asociándolos a pacientes...`);

  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/expedients/new`, { waitUntil: 'networkidle' });

    const expCode = `EXP-FARM-${Date.now().toString().slice(-6)}-${i}`;
    const expName = `Expediente Paciente Farmacéutico ${i}`;

    // Paso 1: Información básica
    await page.locator('input[placeholder="Ej. EXP-2026-0001"]').fill(expCode);
    await page.locator('input[placeholder="Ej. Alta de proveedor Andes"]').fill(expName);

    const typeSelect = page.locator('.type-select-row select');
    await typeSelect.selectOption({ index: 1 });

    const deptSelect = page.locator('select:below(label:has-text("Área responsable"))').first();
    if (await deptSelect.count() > 0 && (await deptSelect.locator('option').count()) > 1) {
      await deptSelect.selectOption({ index: 1 });
    }

    await page.locator('textarea[placeholder*="Describe el objetivo"]').fill(`Expediente médico automatizado Farmacorp ${i} asociado a paciente`);

    // Continuar a Paso 2
    await page.locator('button.primary-button:has-text("Continuar")').click();
    await page.waitForTimeout(500);

    // Paso 2: Responsables y participantes (asociar al paciente)
    const respSelect = page.locator('select:below(label:has-text("Responsable principal"))').first();
    if (await respSelect.count() > 0 && (await respSelect.locator('option').count()) > 1) {
      await respSelect.selectOption({ index: 1 });
    }

    // Asociar participante tipo Paciente
    const associatedPatientId = resultData.patients[i - 1];
    if (associatedPatientId) {
      const sourceSelect = page.locator('select[aria-label="Tipo de participante"]');
      if (await sourceSelect.count() > 0) {
        await sourceSelect.selectOption('PATIENT');
        const patSelect = page.locator('select[aria-label="Seleccionar paciente"]');
        await patSelect.waitFor({ state: 'visible' });
        await patSelect.selectOption({ value: associatedPatientId });

        await page.locator('button:has-text("＋ Añadir")').click();
        await page.waitForTimeout(300);
      }
    }

    // Continuar a Paso 3
    await page.locator('button.primary-button:has-text("Continuar")').click();
    await page.waitForTimeout(500);

    // Paso 3: Confirmar y guardar
    const [expRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/expedients') && r.request().method() === 'POST', { timeout: 20000 }),
      page.locator('button.primary-button:has-text("Crear expediente")').click()
    ]);

    const status = expRes.status();
    const expData = await expRes.json();
    assert([200, 201].includes(status), `Error al crear expediente ${i}: status ${status}`);
    console.log(`[EXPEDIENTES] (${i}/10) Creado: ${expData.id} - ${expCode}`);
    resultData.expedients.push(expData.id);

    await page.waitForTimeout(500);
  }
}

async function populateWorkflows(page) {
  console.log(`\n========================================`);
  console.log(`[WORKFLOWS] Creando y activando 10 workflows en /workflows/designer...`);

  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/workflows/designer`, { waitUntil: 'networkidle' });

    const wfName = `Flujo de Control Farmacéutico Farmacorp ${i}`;

    // Paso 1: Abrir información para configurar nombre y activar
    await page.locator('button.wf-secondary:has-text("Información")').click();
    await page.waitForTimeout(500);

    await page.locator('.wf-template-form input[maxlength="150"]').fill(wfName);
    await page.locator('.wf-template-form input[maxlength="4000"]').fill(`Plantilla y flujo de control ${i}`);

    // Seleccionar publicación Activa
    const pubSelect = page.locator('select:has(option[value="ACTIVE"])');
    if (await pubSelect.count() > 0) {
      await pubSelect.selectOption('ACTIVE');
    }

    // Volver al lienzo
    await page.locator('button.wf-designer-back').first().click();
    await page.waitForTimeout(500);

    // Guardar plantilla y flujo activo con saveAndStart (botón "Guardar workflow")
    const [wfRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/workflows/templates') && ['POST', 'PUT'].includes(r.request().method()), { timeout: 20000 }),
      page.locator('button.wf-primary:has-text("Guardar workflow")').click()
    ]);

    const status = wfRes.status();
    const tplData = await wfRes.json();
    assert([200, 201].includes(status), `Error al guardar workflow ${i}: status ${status}`);
    console.log(`[WORKFLOWS] (${i}/10) Creado y activado: ${tplData.id} - ${wfName}`);
    resultData.workflows.push(tplData.id);

    await page.waitForTimeout(500);
  }
}

async function populatePhysicalArchive(page) {
  console.log(`\n========================================`);
  console.log(`[ARCHIVO FÍSICO] Registrando 10 originales físicos en /physical-archive...`);

  for (let i = 1; i <= 10; i++) {
    await page.goto(`${BASE_URL}/physical-archive`, { waitUntil: 'networkidle' });

    const regBtn = page.getByRole('button', { name: 'Registrar original' }).or(page.locator('button:has-text("Registrar original")'));
    await regBtn.first().click();

    const editor = page.locator('dialog[open]');
    await editor.waitFor({ state: 'visible' });

    const itemCode = `BARCODE-FARM-${Date.now().toString().slice(-6)}-${i}`;
    const itemName = `Legajo Físico Farmacéutico Farmacorp ${i}`;

    await editor.locator('input[name="code"]').fill(itemCode);
    await editor.locator('input[name="name"]').fill(itemName);

    // Ubicación
    const locSelect = editor.locator('select[name="loc"]');
    await locSelect.selectOption({ index: 1 });

    // Custodio
    const custSelect = editor.locator('select[name="custodian"]');
    if (await custSelect.locator('option').count() > 1) {
      await custSelect.selectOption({ index: 1 });
    }

    // Vincular documento si existe
    if (resultData.documents[i - 1]) {
      const docSelect = editor.locator('select[name="doc"]');
      try {
        await docSelect.selectOption({ value: resultData.documents[i - 1] });
      } catch {}
    }

    // Vincular expediente si existe
    if (resultData.expedients[i - 1]) {
      const expSelect = editor.locator('select[name="exp"]');
      try {
        await expSelect.selectOption({ value: resultData.expedients[i - 1] });
      } catch {}
    }

    await editor.locator('textarea[name="condition"]').fill(`Original íntegro con código de barras ${itemCode}. Ubicado en estante.`);

    const [physRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/v1/physical-archive/items') && r.request().method() === 'POST', { timeout: 20000 }),
      editor.locator('button.primary:has-text("Guardar ficha")').click()
    ]);

    const status = physRes.status();
    const physData = await physRes.json();
    assert([200, 201].includes(status), `Error al crear original físico ${i}: status ${status}`);
    console.log(`[ARCHIVO FÍSICO] (${i}/10) Creado: ${physData.id} - ${itemCode}`);
    resultData.physical.push(physData.id);

    await page.waitForTimeout(500);
  }
}

async function main() {
  console.log('--- Iniciando automatización completa para tenant Farmacorp Demo ---');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    // 1. Iniciar sesión en UI
    await login(page);

    // 2. Dar de alta 10 pacientes
    await populatePatients(page);

    // 3. Subir 10 archivos PDF
    await populateDocuments(page);

    // 4. Crear 10 expedientes asociados a los pacientes
    await populateExpedients(page);

    // 5. Crear y activar 10 workflows
    await populateWorkflows(page);

    // 6. Registrar 10 originales físicos
    await populatePhysicalArchive(page);

    // Guardar resultados en data-farmacorp.json
    const outputPath = path.resolve('data-farmacorp.json');
    fs.writeFileSync(outputPath, JSON.stringify(resultData, null, 2), 'utf8');
    console.log(`\n========================================`);
    console.log(`[ÉXITO] Todos los registros generados han sido guardados en: ${outputPath}`);
    console.log(`Resumen de IDs generados:`);
    console.log(`- Pacientes: ${resultData.patients.length}`);
    console.log(`- Documentos: ${resultData.documents.length}`);
    console.log(`- Expedientes: ${resultData.expedients.length}`);
    console.log(`- Workflows: ${resultData.workflows.length}`);
    console.log(`- Archivo Físico: ${resultData.physical.length}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[ERROR FATAL]', err);
  process.exit(1);
});
