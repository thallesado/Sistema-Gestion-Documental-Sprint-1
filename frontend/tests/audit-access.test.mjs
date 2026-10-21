import assert from 'node:assert/strict';
import test from 'node:test';

import { canReadAuditLog } from '../src/app/features/auditoria/audit-access.ts';

test('a custom group with audit:read_tenant can open the audit page', () => {
  assert.equal(canReadAuditLog({ platformAdmin: false, roleNames: ['Auditores'], permissions: ['audit:read_tenant'] }), true);
});

test('audit:read_global also grants access', () => {
  assert.equal(canReadAuditLog({ platformAdmin: false, roleNames: [], permissions: ['audit:read_global'] }), true);
});

test('an administrator role name without audit permissions is denied', () => {
  assert.equal(canReadAuditLog({ platformAdmin: false, roleNames: ['Administrador de tenant'], permissions: ['document:read'] }), false);
});

test('platform admins keep access and no session is denied', () => {
  assert.equal(canReadAuditLog({ platformAdmin: true, roleNames: [], permissions: [] }), true);
  assert.equal(canReadAuditLog(null), false);
});
