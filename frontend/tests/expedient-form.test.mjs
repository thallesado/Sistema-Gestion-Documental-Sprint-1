import assert from 'node:assert/strict';
import test from 'node:test';
import { expedientBasicsError, conflictMessage } from '../src/app/core/data/expedient-form.ts';

test('step one needs code, name and type before moving on', () => {
  assert.equal(expedientBasicsError({ code: '', name: 'x', expedientTypeId: 't' }) !== '', true);
  assert.equal(expedientBasicsError({ code: 'EXP-1', name: '   ', expedientTypeId: 't' }) !== '', true);
  assert.equal(expedientBasicsError({ code: 'EXP-1', name: 'Nombre', expedientTypeId: '' }) !== '', true);
  assert.equal(expedientBasicsError({ code: ' EXP-1 ', name: 'Nombre', expedientTypeId: 't' }), '');
});

test('a conflict shows the server reason and falls back to a useful sentence', () => {
  assert.equal(conflictMessage({ message: 'Ya existe un expediente con el código EXP-1' }, 'expediente'),
    'Ya existe un expediente con el código EXP-1');
  assert.equal(conflictMessage(null, 'expediente'), 'Ya existe un expediente con esos datos. Revisa el código.');
  assert.equal(conflictMessage({ message: '  ' }, 'paciente'), 'Ya existe un paciente con esos datos. Revisa el código.');
});
