import assert from 'node:assert/strict';
import test from 'node:test';
import { assignableRoles } from '../src/app/core/data/assignable-roles.ts';

const roles = [
  { id: 1, name: 'Administrador de tenant' },
  { id: 7, name: 'Superadministrador' },
  { id: 9, name: 'Superadmin' },
  { id: 3, name: 'Usuario operativo' },
];

test('platform-style groups are not offered to be granted to tenant users', () => {
  assert.deepEqual(assignableRoles(roles, []).map((role) => role.id), [1, 3]);
});

test('a group the user already holds stays visible so it can be kept or removed', () => {
  assert.deepEqual(assignableRoles(roles, [7]).map((role) => role.id), [1, 7, 3]);
});
