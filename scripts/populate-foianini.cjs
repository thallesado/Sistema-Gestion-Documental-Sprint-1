// scripts/populate-foianini.cjs
const fs = require('fs');
const path = require('path');
const http = require('http');

function getPlaywright() {
  try {
    return require('playwright');
  } catch (e) {
    const links = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', '.links');
    if (fs.existsSync(links)) {
      for (const link of fs.readdirSync(links)) {
        try {
          const p = fs.readFileSync(path.join(links, link), 'utf8').trim();
          return require(p);
        } catch (err) {}
      }
    }
    throw new Error('Playwright no se encuentra en el entorno.');
  }
}

const TENANT_ID = '80ba92e7-e54d-4a8f-8dc8-8cca385ce30d';
const TENANT_NAME = 'Clínica Foianini Demo';
const ADMIN_EMAIL = 'admin@foianini.test';
const ADMIN_PASS = 'DemoPass123!';
const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://127.0.0.1:8080/api/v1';

const DOCUMENT_TYPES = [
  'bf872f7f-be10-47ba-aa69-16cb3926bd89', // Informe Clínico
  'aa8c9592-3696-484d-8526-16af634d26ba', // Consentimiento Informado
  '13e69ca3-e0c7-45e4-881e-9b771e3791af', // Exámenes y Laboratorio
  'ae1c7007-e352-405d-9cab-c2efaaf77f50', // Historia clínica
];

const EXPEDIENT_TYPE_ID = '61b9e37f-8ab6-4c08-b1c4-ba8b5c1951c8';
const LOCATION_ID = '43fc38b7-a187-422c-b241-fb8725d6abcb';
const WORKFLOW_TEMPLATE_ID = '65c50adc-a6ba-45dd-aa6e-0440a55ebca3'; // Revisión documental

const PDF_DIR = path.resolve(__dirname, '..', 'synthetic-pdfs', 'clinica-foianini');

const PDF_FILES = [
  'Historia_Clinica_Inicial.pdf',
  'Informe_Laboratorio_Hemograma.pdf',
  'Consentimiento_Informado_Cirugia.pdf',
  'Epicrisis_Alta_Hospitalaria.pdf',
  'Informe_Radiologia_Torax.pdf',
  'Resumen_Intervencion_Quirurgica.pdf',
  'Evaluacion_Preanestesica.pdf',
  'Nota_Evolucion_Medica.pdf',
  'Receta_Tratamiento_Ambulatorio.pdf',
  'Certificado_Medico_Aptitud.pdf'
];

async function main() {
  console.log('=== POBLANDO TENANT: ' + TENANT_NAME + ' ===');
  const { chromium } = getPlaywright();
  const chromePath = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium-1254', 'chrome-win64', 'chrome.exe');
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('1. Navegando a Login UI: ' + BASE_URL + '/login');
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });

  // Selección de tenant y login en UI
  console.log('2. Realizando autenticación vía UI...');
  const tenantSelect = page.locator('select, [formcontrolname="tenantId"], #tenantId').first();
  if (await tenantSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tenantSelect.selectOption({ value: TENANT_ID }).catch(async () => {
      await tenantSelect.selectOption({ label: TENANT_NAME }).catch(() => {});
    });
  }

  const userInput = page.locator('input[type="email"], input[formcontrolname="usernameOrEmail"], input[name="username"]').first();
  await userInput.fill(ADMIN_EMAIL);

  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(ADMIN_PASS);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  await page.waitForLoadState('networkidle');
  console.log('URL tras login:', page.url());

  // Obtener token y headers de sesión desde el almacenamiento del navegador
  const token = await page.evaluate(() => {
    return localStorage.getItem('token') || 
           localStorage.getItem('auth_token') || 
           localStorage.getItem('access_token') ||
           sessionStorage.getItem('token') ||
           sessionStorage.getItem('access_token') ||
           (JSON.parse(localStorage.getItem('auth') || '{}')).token ||
           (JSON.parse(sessionStorage.getItem('auth') || '{}')).token;
  });

  console.log('Token obtenido del navegador:', token ? 'OK (' + token.substring(0, 15) + '...)' : 'Fallback a login directo');
  let authToken = token;

  if (!authToken) {
    const loginRes = await context.request.post('http://127.0.0.1:8080/api/v1/auth/login', {
      data: {
        tenantId: TENANT_ID,
        usernameOrEmail: ADMIN_EMAIL,
        password: ADMIN_PASS
      }
    });
    const loginJson = await loginRes.json();
    authToken = loginJson.token || loginJson.accessToken;
    console.log('Token obtenido via API Context:', authToken ? 'OK' : 'Error');
  }

  const reqHeaders = {
    'Authorization': 'Bearer ' + authToken,
    'X-Tenant-ID': TENANT_ID
  };

  const results = {
    tenant: TENANT_NAME,
    patients: [],
    documents: [],
    expedients: [],
    workflows: [],
    physical: []
  };

  // 1. CREAR 10 PACIENTES
  console.log('\n--- CREANDO 10 PACIENTES ---');
  const patientDataList = [
    { doc: '7011001', first: 'Carlos', last: 'Foianini Aguilera', gen: 'MALE', birth: '1980-05-12', phone: '71000001' },
    { doc: '7011002', first: 'Mariana', last: 'Suarez Roca', gen: 'FEMALE', birth: '1985-08-22', phone: '71000002' },
    { doc: '7011003', first: 'Rodrigo', last: 'Justiniano Mendez', gen: 'MALE', birth: '1992-01-15', phone: '71000003' },
    { doc: '7011004', first: 'Valeria', last: 'Vaca Diez', gen: 'FEMALE', birth: '1995-11-30', phone: '71000004' },
    { doc: '7011005', first: 'Fernando', last: 'Antelo Rivero', gen: 'MALE', birth: '1978-03-09', phone: '71000005' },
    { doc: '7011006', first: 'Gabriela', last: 'Chavez Saucedo', gen: 'FEMALE', birth: '1988-07-19', phone: '71000006' },
    { doc: '7011007', first: 'Mateo', last: 'Ribera Costas', gen: 'MALE', birth: '2001-09-04', phone: '71000007' },
    { doc: '7011008', first: 'Lucia', last: 'Paz Soldan', gen: 'FEMALE', birth: '1990-12-14', phone: '71000008' },
    { doc: '7011009', first: 'Alejandro', last: 'Kempff Mercado', gen: 'MALE', birth: '1983-04-25', phone: '71000009' },
    { doc: '7011010', first: 'Sofia', last: 'Zabala Dorado', gen: 'FEMALE', birth: '1997-06-18', phone: '71000010' }
  ];

  for (let i = 0; i < patientDataList.length; i++) {
    const p = patientDataList[i];
    const res = await context.request.post('http://127.0.0.1:8080/api/v1/patients', {
      headers: reqHeaders,
      data: {
        documentType: 'CI',
        documentNumber: p.doc,
        firstName: p.first,
        lastName: p.last,
        birthDate: p.birth,
        gender: p.gen,
        phone: p.phone,
        email: 'paciente.' + p.doc + '@foianini.test'
      }
    });

    if (res.status() === 201 || res.status() === 200) {
      const pBody = await res.json();
      console.log(`[Paciente ${i+1}/10] Creado: ID ${pBody.id} - ${p.first} ${p.last}`);
      results.patients.push(pBody.id);
    } else {
      const errText = await res.text();
      console.error(`[Paciente ${i+1}/10] Error status ${res.status()}: ${errText}`);
    }
  }

  // 2. CREAR 10 EXPEDIENTES (ASOCIADOS A LOS 10 PACIENTES)
  console.log('\n--- CREANDO 10 EXPEDIENTES ---');
  for (let i = 0; i < results.patients.length; i++) {
    const patientId = results.patients[i];
    const code = `EXP-FOIA-2026-${String(i+1).padStart(3, '0')}`;
    const name = `Expediente Clínico Integral - ${patientDataList[i].first} ${patientDataList[i].last}`;
    
    const res = await context.request.post('http://127.0.0.1:8080/api/v1/expedients', {
      headers: reqHeaders,
      data: {
        expedientTypeId: EXPEDIENT_TYPE_ID,
        code: code,
        name: name,
        description: `Expediente clínico del paciente ${patientDataList[i].first} ${patientDataList[i].last}`,
        patientId: patientId
      }
    });

    if (res.status() === 201 || res.status() === 200) {
      const expBody = await res.json();
      console.log(`[Expediente ${i+1}/10] Creado: ID ${expBody.id} - ${code}`);
      results.expedients.push(expBody.id);
    } else {
      const errText = await res.text();
      console.error(`[Expediente ${i+1}/10] Error status ${res.status()}: ${errText}`);
    }
  }

  // 3. SUBIR 10 DOCUMENTOS (PDFs sintéticos)
  console.log('\n--- SUBIENDO 10 DOCUMENTOS ---');
  for (let i = 0; i < PDF_FILES.length; i++) {
    const pdfName = PDF_FILES[i];
    const pdfPath = path.join(PDF_DIR, pdfName);
    const docTypeId = DOCUMENT_TYPES[i % DOCUMENT_TYPES.length];
    const expId = results.expedients[i] || results.expedients[0];
    const patId = results.patients[i] || results.patients[0];
    const docCode = `DOC-FOIA-2026-${String(i+1).padStart(3, '0')}`;
    const docTitle = pdfName.replace('.pdf', '').replace(/_/g, ' ');

    // Crear registro de documento
    const createRes = await context.request.post('http://127.0.0.1:8080/api/v1/documents', {
      headers: reqHeaders,
      data: {
        documentTypeId: docTypeId,
        expedientId: expId,
        patientId: patId,
        code: docCode,
        name: docTitle,
        description: `Documento clínico digitalizado: ${docTitle}`,
        issueDate: '2026-02-15'
      }
    });

    if (createRes.status() === 201 || createRes.status() === 200) {
      const docData = await createRes.json();
      const docId = docData.id;
      console.log(`[Documento ${i+1}/10] Creado metadata: ID ${docId} - ${docCode}`);

      // Subir archivo binario como versión 1
      const fileBuffer = fs.readFileSync(pdfPath);
      const uploadRes = await context.request.post(`http://127.0.0.1:8080/api/v1/documents/${docId}/versions`, {
        headers: {
          'Authorization': 'Bearer ' + authToken,
          'X-Tenant-ID': TENANT_ID
        },
        multipart: {
          file: {
            name: pdfName,
            mimeType: 'application/pdf',
            buffer: fileBuffer
          },
          changeReason: 'Carga inicial de documento sintético clínico'
        }
      });

      if (uploadRes.status() === 201 || uploadRes.status() === 200) {
        console.log(`[Documento ${i+1}/10] Archivo PDF subido exitosamente a versión 1.`);
        results.documents.push(docId);
      } else {
        const upErr = await uploadRes.text();
        console.warn(`[Documento ${i+1}/10] Subida de versión retornó ${uploadRes.status()}: ${upErr}`);
        results.documents.push(docId);
      }
    } else {
      const err = await createRes.text();
      console.error(`[Documento ${i+1}/10] Error creando documento: ${createRes.status()} - ${err}`);
    }
  }

  // 4. CREAR Y ACTIVAR 10 WORKFLOWS
  console.log('\n--- CREANDO Y ACTIVANDO 10 WORKFLOWS ---');
  for (let i = 0; i < 10; i++) {
    const wfTitle = `Flujo de Revisión Clínica Foianini #${i+1} - 2026`;
    const wfDesc = `Flujo de validación médica y auditoría documental de paciente #${i+1}`;
    
    const wfRes = await context.request.post(`http://127.0.0.1:8080/api/v1/workflows/templates/${WORKFLOW_TEMPLATE_ID}/instantiate`, {
      headers: reqHeaders,
      data: {
        title: wfTitle,
        description: wfDesc,
        priority: 2
      }
    });

    if (wfRes.status() === 201 || wfRes.status() === 200) {
      const wfData = await wfRes.json();
      console.log(`[Workflow ${i+1}/10] Creado y Activo: ID ${wfData.id} - ${wfTitle}`);
      results.workflows.push(wfData.id);
    } else {
      const err = await wfRes.text();
      console.error(`[Workflow ${i+1}/10] Error: ${wfRes.status()} - ${err}`);
    }
  }

  // 5. REGISTRAR 10 ELEMENTOS EN ARCHIVO FÍSICO
  console.log('\n--- REGISTRANDO 10 ELEMENTOS EN ARCHIVO FÍSICO ---');
  const userAdminId = 'aa5b6190-12c0-43e7-8a26-c5a9b8cb2620';

  for (let i = 0; i < 10; i++) {
    const itemCode = `FOIA-PHYS-${String(i+1).padStart(3, '0')}`;
    const itemName = `Expediente Físico Impreso Original #${i+1}`;
    const barcode = `BC-FOIA-${String(i+1).padStart(4, '0')}`;
    const expId = results.expedients[i] || null;

    const physRes = await context.request.post('http://127.0.0.1:8080/api/v1/physical-archive/items', {
      headers: reqHeaders,
      data: {
        code: itemCode,
        name: itemName,
        locationId: LOCATION_ID,
        custodianId: userAdminId,
        condition: 'Original bajo custodia en archivo central',
        barcode: barcode,
        expedientId: expId
      }
    });

    if (physRes.status() === 201 || physRes.status() === 200) {
      const physData = await physRes.json();
      console.log(`[Archivo Físico ${i+1}/10] Creado: ID ${physData.id} - ${itemCode} (${barcode})`);
      results.physical.push(physData.id);
    } else {
      const err = await physRes.text();
      console.error(`[Archivo Físico ${i+1}/10] Error: ${physRes.status()} - ${err}`);
    }
  }

  // Guardar archivo JSON
  const outPath = path.resolve(__dirname, '..', 'data-clinica-foianini.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\n✅ Resultados guardados exitosamente en: ' + outPath);
  console.log(`Resumen de IDs guardados:
  - Pacientes: ${results.patients.length}
  - Documentos: ${results.documents.length}
  - Expedientes: ${results.expedients.length}
  - Workflows: ${results.workflows.length}
  - Archivo Físico: ${results.physical.length}
  `);

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error en populate-foianini:', err);
  process.exit(1);
});
