import assert from 'node:assert/strict';
import test from 'node:test';
import { linkableExpedients } from '../src/app/core/data/linkable-expedients.ts';

test('only open expedients can receive a new document, sorted by code', () => {
  const list = [
    { id: 'b', code: 'EXP-2', name: 'Segundo', status: 'ACTIVE' },
    { id: 'c', code: 'EXP-3', name: 'Cerrado', status: 'CLOSED' },
    { id: 'a', code: 'EXP-1', name: 'Primero', status: 'ACTIVE' },
    { id: 'd', code: 'EXP-4', name: 'Archivado', status: 'ARCHIVED' },
  ];
  assert.deepEqual(linkableExpedients(list).map((e) => e.id), ['a', 'b']);
});

test('an empty or missing list is harmless', () => {
  assert.deepEqual(linkableExpedients([]), []);
  assert.deepEqual(linkableExpedients(undefined), []);
});
