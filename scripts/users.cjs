// users.cjs - Automatización completa de creación y verificación de usuarios
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
    throw new Error('Playwright no está instalado o no se encuentra.');
  }
}

async function loginApi(tenantId, usernameOrEmail, password) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ tenantId, usernameOrEmail, password });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8080,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, data: b });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Configuración de los 5 tenants (preexistentes y creados)
const tenantsConfig = [
  {
    name: 'FinoCode',
    id: '20000000-0000-0000-0000-000000000001',
    slug: 'acme',
    adminLoginEmail: 'laura@acme.com',
    adminLoginPass: 'DemoPass123!',
    adminRoleId: 1,
    userRoleId: 3,
  },
  {
    name: 'Clínica Central',
    id: '20000000-0000-0000-0000-000000000002',
    slug: 'clinica-central',
    adminLoginEmail: 'maria@clinicacentral.test',
    adminLoginPass: 'DemoPass123!',
    adminRoleId: 4,
    userRoleId: 10,
  },
  {
    name: 'HU09 - Demostracion sintetica',
    id: 'e315ea65-e3e9-4577-93eb-dde327a03a9f',
    slug: 'hu09-demo',
    adminLoginEmail: 'hu09-1793982530689@example.test',
    adminLoginPass: 'DemoPass123!',
    adminRoleId: 32,
    userRoleId: 74,
  },
  {
    name: 'Test Tenant Onboarding',
    id: 'fdc6ed95-fabc-462d-859a-949c0ea31080',
    slug: 'test-onboarding',
    adminLoginEmail: 'test.onboarding.1@demo.invalid',
    adminLoginPass: 'DemoPass123!',
    adminRoleId: 41,
    userRoleId: 76,
  },
  {
    name: 'Clinica Test Onboarding',
    id: '29b091dd-16a3-4c37-9987-f9ae1cbb3024',
    slug: 'clinica-test',
    adminLoginEmail: 'test.admin.1@foianini.invalid',
    adminLoginPass: 'DemoLocal2026!',
    adminRoleId: 54,
    userRoleId: 82,
  },
];

async function run() {
  const pw = getPlaywright();
  const browser = await pw.chromium.launch({ headless: true });
  const baseUrl = process.env.APP_URL || 'http://localhost:4200';
  
  console.log(`Iniciando creación y verificación de usuarios en ${tenantsConfig.length} tenants...`);
  
  for (const tenant of tenantsConfig) {
    console.log(`\n=============================================================`);
    console.log(`Procesando Tenant: ${tenant.name} (${tenant.slug}) [${tenant.id}]`);
    console.log(`=============================================================`);
    
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('nexodocs_lang', 'es');
      const style = document.createElement('style');
      style.innerHTML = `
        .driver-overlay, .driver-popover, .driver-active, .driver-fade {
          display: none !important;
          pointer-events: none !important;
        }
      `;
      document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    });
    
    const page = await context.newPage();
    
    // 1. Iniciar sesión con el admin del tenant vía UI
    console.log(`1. Iniciando sesión UI con admin: ${tenant.adminLoginEmail}...`);
    await page.goto(`${baseUrl}/login`);
    await page.locator('#tenant-input').selectOption(tenant.id);
    await page.locator('#email-input').fill(tenant.adminLoginEmail);
    await page.locator('#password-input').fill(tenant.adminLoginPass);
    await page.locator('button.submit-btn').click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
    console.log(`✓ Sesión UI iniciada exitosamente en ${page.url()}`);
    
    // 2. Navegar al módulo de gestión de usuarios (/users)
    console.log(`2. Navegando vía UI a /users...`);
    await page.goto(`${baseUrl}/users`);
    await page.waitForSelector('header.admin-header', { timeout: 15000 });
    
    // Obtener el token de autenticación de la sesión activa del navegador
    const sessionToken = await page.evaluate(() => sessionStorage.getItem('nexodocs.access_token'));
    if (!sessionToken) {
      throw new Error(`No se encontró access_token en la sesión del navegador para ${tenant.slug}`);
    }
    
    // 3. Crear los 3 usuarios requeridos
    const usersToCreate = [
      {
        type: 'SUPERADMIN',
        roleName: 'Administrador de tenant',
        roleId: tenant.adminRoleId,
        firstName: 'Super',
        lastName: 'Admin',
        username: `admin-${tenant.slug}`,
        email: `admin@${tenant.slug}.example.invalid`,
        password: 'DemoLocal2026!',
      },
      {
        type: 'USER',
        roleName: 'Usuario operativo',
        roleId: tenant.userRoleId,
        firstName: 'Usuario',
        lastName: 'Uno',
        username: `user1-${tenant.slug}`,
        email: `user1@${tenant.slug}.example.invalid`,
        password: 'DemoLocal2026!',
      },
      {
        type: 'USER',
        roleName: 'Usuario operativo',
        roleId: tenant.userRoleId,
        firstName: 'Usuario',
        lastName: 'Dos',
        username: `user2-${tenant.slug}`,
        email: `user2@${tenant.slug}.example.invalid`,
        password: 'DemoLocal2026!',
      },
    ];
    
    const tenantCreatedUsers = [];
    
    for (const u of usersToCreate) {
      console.log(`3. Creando usuario: ${u.email} [${u.type} / ${u.roleName}]...`);
      
      // Creación autenticada a través del contexto web del usuario administrador
      const createResponse = await page.evaluate(async (payload) => {
        const token = sessionStorage.getItem('nexodocs.access_token');
        const res = await fetch('/api/v1/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        return { status: res.status, data };
      }, {
        firstName: u.firstName,
        lastName: u.lastName,
        username: u.username,
        email: u.email,
        password: u.password,
        roleIds: [u.roleId],
      });
      
      if (createResponse.status !== 201) {
        throw new Error(`Fallo al crear usuario ${u.email}: status ${createResponse.status} - ${JSON.stringify(createResponse.data)}`);
      }
      
      const createdData = createResponse.data;
      console.log(`✓ Usuario creado: ID=${createdData.id}, Roles=[${createdData.roleNames?.join(', ')}]`);
      
      tenantCreatedUsers.push({
        id: createdData.id,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        username: u.username,
        email: u.email,
        expectedRole: u.type,
        assignedRoles: createdData.roleNames,
        status: createdData.status,
      });
      
      // 4. Verificar inicio de sesión del usuario recién creado
      console.log(`4. Verificando inicio de sesión para ${u.email}...`);
      const loginCheck = await loginApi(tenant.id, u.email, u.password);
      if (loginCheck.status !== 200 || !loginCheck.data?.token) {
        throw new Error(`El usuario ${u.email} no pudo iniciar sesión. Status: ${loginCheck.status} - ${JSON.stringify(loginCheck.data)}`);
      }
      console.log(`✓ Login verificado OK. Token generado (${loginCheck.data.authorities?.length || 0} permisos activos).`);
    }
    
    // Recargar vista UI de usuarios para reflejar los nuevos registros en la tabla
    await page.reload();
    await page.waitForSelector('section.admin-table-wrap table', { timeout: 15000 });
    console.log(`✓ Vista /users refrescada. Tabla de usuarios visible en pantalla.`);
    
    // 5. Guardar archivo con los IDs: users-<tenant>.json
    const outputFilename = `users-${tenant.slug}.json`;
    const outputPath = path.resolve(outputFilename);
    const resultJson = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      generatedAt: new Date().toISOString(),
      userCount: tenantCreatedUsers.length,
      users: tenantCreatedUsers,
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(resultJson, null, 2), 'utf8');
    console.log(`✓ Archivo guardado con éxito: ${outputFilename}`);
    
    await context.close();
  }
  
  await browser.close();
  console.log(`\n=============================================================`);
  console.log(`TODOS LOS USUARIOS (15 usuarios en 5 tenants) FUERON CREADOS Y VERIFICADOS.`);
  console.log(`=============================================================`);
}

run().catch(err => {
  console.error('\nERROR en ejecución:', err);
  process.exitCode = 1;
});
