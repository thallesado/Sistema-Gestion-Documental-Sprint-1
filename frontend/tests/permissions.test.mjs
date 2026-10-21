import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { TENANT_PLAN_ADMIN, hasPermission, permittedChildren } from '../src/app/core/auth/permission-rules.ts';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const source = await readFile(path.join(frontend, 'src/app/core/data/nexodocs-data.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
new Function('require', 'exports', compiled)(require, exports);
const { navSections } = exports;

/** Reproduce el filtro del shell: sprint activo, visibles y permitidos. */
const visibleMenu = (granted) => navSections.flatMap((section) => section.items
  .filter((item) => item.sprintEnabled !== false)
  .map((item) => ({
    label: item.label,
    children: permittedChildren(item, granted)
      .filter((child) => child.visible !== false && child.sprintEnabled !== false)
      .map((child) => child.href),
  }))
  .filter((item) => item.children.length > 0));

test('hasPermission: un código, cualquiera de una lista y requisito ausente', () => {
  assert.equal(hasPermission(['document:read'], 'document:read'), true);
  assert.equal(hasPermission(['document:read'], 'document:create'), false);
  assert.equal(hasPermission(['audit:read_global'], ['audit:read_tenant', 'audit:read_global']), true);
  assert.equal(hasPermission([], ['audit:read_tenant', 'audit:read_global']), false);
  assert.equal(hasPermission(undefined, 'document:read'), false);
  assert.equal(hasPermission([], undefined), true);
  assert.equal(hasPermission([], []), true);
});

test('permittedChildren: los hijos heredan el permiso del padre y aplican el propio', () => {
  const item = { permission: 'document:read', children: [{ href: '/a' }, { href: '/b', permission: 'document:create' }] };
  assert.deepEqual(permittedChildren(item, ['document:read']).map((c) => c.href), ['/a']);
  assert.deepEqual(permittedChildren(item, ['document:create']), []);
  assert.deepEqual(permittedChildren(item, ['document:read', 'document:create']).map((c) => c.href), ['/a', '/b']);
});

test('un rol personalizado con solo document:read ve unicamente lo que ese permiso habilita', () => {
  const menu = visibleMenu(['document:read']);
  assert.deepEqual(menu.map((item) => item.label), ['Inicio', 'Documentos']);
  const documents = menu.find((item) => item.label === 'Documentos').children;
  assert.ok(documents.includes('/documents'));
  assert.ok(documents.includes('/documents/mine'));
  assert.ok(!documents.includes('/documents/new'), 'crear documento exige document:create');
  assert.ok(!documents.includes('/documents/upload'), 'subir archivo exige document:create');
});

test('sin permisos de administracion no aparecen usuarios, auditoria, facturacion ni tenants', () => {
  const labels = visibleMenu(['document:read', 'workflow:read']).map((item) => item.label);
  for (const hidden of ['Usuarios y equipos', 'Auditoria', 'Facturacion e ingresos', 'Tenants', 'Digitalizacion']) {
    assert.ok(!labels.includes(hidden), `${hidden} no debe mostrarse`);
  }
  assert.ok(labels.includes('Workflows'));
});

test('el menu de usuarios y grupos depende de user:read, role:read y permission:read', () => {
  const onlyUsers = visibleMenu(['user:read']).find((item) => item.label === 'Usuarios y equipos');
  assert.deepEqual(onlyUsers.children, ['/users']);
  const full = visibleMenu(['user:read', 'role:read', 'permission:read']).find((item) => item.label === 'Usuarios y equipos');
  assert.deepEqual(full.children, ['/users', '/users/roles', '/users/permissions']);
});

test('ninguna entrada del menu filtra por nombres de rol fijos', () => {
  for (const section of navSections) {
    for (const item of section.items) assert.equal(item.roles, undefined, `${item.label} usa roles fijos`);
  }
});

const MEDICO_ESPECIALISTA = [
  'document:approve', 'document:create', 'document:download', 'document:read', 'document:update',
  'document_version:create', 'document_version:read', 'document_version:update',
  'expedient:create', 'expedient:read', 'expedient:update', 'patient:create', 'patient:read', 'patient:update',
];

test('el perfil Médico Especialista ve Expedientes, Módulo Clínico y Documentos además de Inicio', () => {
  const labels = visibleMenu(MEDICO_ESPECIALISTA).map((item) => item.label);
  for (const label of ['Inicio', 'Expedientes', 'Módulo Clínico', 'Documentos']) assert.ok(labels.includes(label), label);
  for (const label of ['Workflows', 'Usuarios y equipos', 'Facturacion e ingresos']) assert.ok(!labels.includes(label), label);
});

test('planes, precios y facturación solo para el administrador del tenant', () => {
  assert.equal(hasPermission(MEDICO_ESPECIALISTA, TENANT_PLAN_ADMIN), false);
  assert.equal(hasPermission(['tenant:update'], TENANT_PLAN_ADMIN), true);
  assert.equal(hasPermission(['tenant:manage'], TENANT_PLAN_ADMIN), true);
  const billing = (granted) => visibleMenu(granted).some((item) => item.children.includes('/billing'));
  assert.equal(billing(['tenant:update']), true);
  assert.equal(billing(['platform:tenant:manage']), true);
  assert.equal(billing(MEDICO_ESPECIALISTA), false);
});

test('audit read permission shows every audit entry in the menu', () => {
  const audit = visibleMenu(new Set(['audit:read_tenant'])).find((item) => item.label === 'Auditoria');
  assert.deepEqual(audit?.children, [
    '/audit',
    '/audit/access',
    '/audit/document-creation',
    '/audit/modifications',
    '/audit/downloads',
    '/audit/approvals',
    '/audit/deletions',
    '/audit/permissions',
  ]);
});
