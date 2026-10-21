import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FORM_REGISTRY, componentState, splitFieldKey } from '../src/app/core/auth/form-registry.ts';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const javaCatalog = await readFile(path.join(repo,
  'backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/ComponentFormCatalog.java'), 'utf8');

/** Formularios y componentes declarados en ComponentFormCatalog.java, en orden. */
function parseJavaCatalog(source) {
  const constants = Object.fromEntries([...source.matchAll(/static final String (\w+) = "([^"]+)";/g)].map((m) => [m[1], m[2]]));
  return [...source.matchAll(/register\(new Form\((\w+), "[^"]*", List\.of\(([\s\S]*?)\)\)\);/g)].map((m) => ({
    key: constants[m[1]],
    components: [...m[2].matchAll(/new Component\("([^"]+)"/g)].map((c) => c[1]),
  }));
}

test('el catalogo del frontend coincide con el allowlist del backend', () => {
  const backend = parseJavaCatalog(javaCatalog);
  assert.ok(backend.length >= 3, 'se esperan al menos tres formularios');
  assert.deepEqual(
    FORM_REGISTRY.map((form) => ({ key: form.key, components: form.components.map((c) => c.key) })),
    backend,
  );
});

test('cada componente tiene etiqueta y clave valida para la base de datos', () => {
  for (const form of FORM_REGISTRY) {
    assert.match(form.key, /^[a-z][a-z0-9_.]*$/);
    assert.ok(form.label);
    for (const component of form.components) {
      assert.match(component.key, /^[a-z][a-z0-9_]*$/);
      assert.ok(component.label, `${form.key}.${component.key} sin etiqueta`);
    }
  }
});

test('splitFieldKey separa el formulario del componente por el ultimo punto', () => {
  assert.deepEqual(splitFieldKey('documento.nuevo.codigo'), { form: 'documento.nuevo', component: 'codigo' });
  assert.deepEqual(splitFieldKey('usuario.correo'), { form: 'usuario', component: 'correo' });
  assert.throws(() => splitFieldKey('sinpunto'));
  assert.throws(() => splitFieldKey('documento.'));
});

test('sin estado informado el componente es visible y editable', () => {
  assert.equal(componentState(undefined, 'codigo'), 'VISIBLE_EDITABLE');
  assert.equal(componentState({ codigo: 'HIDDEN' }, 'codigo'), 'HIDDEN');
  assert.equal(componentState({ codigo: 'HIDDEN' }, 'nombre'), 'VISIBLE_EDITABLE');
});
