import assert from 'node:assert/strict';
import test from 'node:test';

import { hasAnyPermission, hasPermission } from '../src/app/core/auth/permission-check.ts';
import { themeVariables } from '../src/app/core/theme/theme-variables.ts';
import { interpolate, isLanguage } from '../src/app/core/i18n/translate.ts';
import { MAX_RECENT_ROUTES, pushBounded, stripQuery } from '../src/app/core/assistant/assistant-context.ts';

test('hasPermission grants nothing until permissions are loaded, then matches exact codes only', () => {
  assert.equal(hasPermission(null, 'document:read'), false);
  assert.equal(hasPermission([], 'document:read'), false);
  assert.equal(hasPermission(['document:read'], 'document:read'), true);
  assert.equal(hasPermission(['document:read'], 'document:create'), false);
  assert.equal(hasPermission(['document:read'], 'document'), false, 'no prefix matching');
});

test('hasAnyPermission is true when at least one code is granted', () => {
  assert.equal(hasAnyPermission(['ocr:read'], ['document:create', 'ocr:read']), true);
  assert.equal(hasAnyPermission(['ocr:read'], ['document:create']), false);
  assert.equal(hasAnyPermission(null, ['ocr:read']), false);
  assert.equal(hasAnyPermission(['ocr:read'], []), false);
});

test('themeVariables only emits well-formed colors', () => {
  // --primary-color keeps the tenant value; the derived --tenant-* tokens are covered by shell-theme.test.mjs.
  assert.equal(themeVariables({ primaryColor: '#087f7b' })['--primary-color'], '#087f7b');
  assert.equal(themeVariables({ primaryColor: '#ABCDEF' })['--primary-color'], '#ABCDEF');
  for (const bad of ['087f7b', '#08f', 'red', '#087f7b; background: url(x)', '', null, undefined]) {
    assert.deepEqual(themeVariables({ primaryColor: bad }), {}, String(bad));
  }
  assert.deepEqual(themeVariables({}), {});
});

test('interpolate fills known placeholders and leaves unknown ones untouched', () => {
  assert.equal(interpolate('Hola {{name}}', { name: 'Ana' }), 'Hola Ana');
  assert.equal(interpolate('{{ n }} de {{total}}', { n: 2, total: 5 }), '2 de 5');
  assert.equal(interpolate('Hola {{name}}', {}), 'Hola {{name}}');
  assert.equal(interpolate('Sin variables'), 'Sin variables');
  assert.equal(interpolate('Valor {{toString}}', {}), 'Valor {{toString}}', 'prototype keys are not params');
});

test('isLanguage accepts only supported languages', () => {
  assert.equal(isLanguage('es'), true);
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('fr'), false);
  assert.equal(isLanguage(null), false);
});

test('pushBounded keeps the last items without mutating its input', () => {
  const original = [1, 2, 3];
  assert.deepEqual(pushBounded(original, 4, 3), [2, 3, 4]);
  assert.deepEqual(original, [1, 2, 3]);
  assert.deepEqual(pushBounded([], 1, 3), [1]);
  assert.equal(MAX_RECENT_ROUTES, 10);
});

test('stripQuery removes query strings and fragments so identifiers or tokens never reach the assistant', () => {
  assert.equal(stripQuery('/reset-password?token=abc'), '/reset-password');
  assert.equal(stripQuery('/documents#top'), '/documents');
  assert.equal(stripQuery('/ocr/jobs/1?x=1#y'), '/ocr/jobs/1');
  assert.equal(stripQuery('/'), '/');
});
