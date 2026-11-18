import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = await readFile(new URL('../src/app/core/config/app.config.ts', import.meta.url), 'utf8');
const i18n = await readFile(new URL('../src/app/core/i18n/i18n.service.ts', import.meta.url), 'utf8');

test('el pipe date usa el locale del idioma de la interfaz, no en-US por defecto', () => {
  assert.match(config, /provide: LOCALE_ID, useFactory: startupLocale/);
  for (const locale of ['es-BO', 'fr-FR', 'zh-CN']) {
    assert.match(config, new RegExp(`registerLocaleData\\(\\w+, '${locale}'\\)`), `falta registrar ${locale}`);
    assert.ok(i18n.includes(`'${locale}'`), `${locale} no es un locale del I18nService`);
  }
});
