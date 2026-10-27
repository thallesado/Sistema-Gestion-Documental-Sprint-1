import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const helpDir = new URL('../public/assets/help/', import.meta.url);
// Windows checkouts (core.autocrlf) use CRLF; the article regexes below expect LF.
const readText = (url) => readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
const drawer = readText(new URL('../src/app/features/help/components/help-drawer.ts', import.meta.url));
const manual = readText(new URL('../../backend/bootstrap/src/main/resources/assistant/manual.md', import.meta.url));
const articles = readdirSync(helpDir).filter((f) => f.endsWith('.md')).map((f) => [f, readText(new URL(f, helpDir))]);
const everything = [...articles.map(([, t]) => t), drawer, manual].join('\n');

const absent = [
  [/perspectiva/i, 'perspective correction is not implemented in OcrService'],
  [/sombras/i, 'shadow removal is not implemented'],
  [/binariz/i, 'binarization is not implemented'],
  [/etapas? paralelas?|paralel[ao]s?\b/i, 'the workflow engine has no parallel stages'],
  [/notificaci[oó]n(es)? por correo|correo electr[oó]nico de bienvenida/i, 'workflows send no e-mail'],
  [/validez (legal|oficial)/i, 'approval does not grant legal validity'],
  [/HIPAA|GDPR/i, 'no compliance certification is implemented'],
  [/TIFF/i, 'OCR accepts PDF, JPEG, PNG and WebP only'],
  [/Apariencia y Uso/i, 'there is no usage screen under Apariencia'],
];
for (const [re, why] of absent) {
  test(`help content does not claim ${re}: ${why}`, () => {
    assert.doesNotMatch(everything, re);
  });
}

test('help has articles for backups, form privileges, audit and appearance in the drawer and as markdown', () => {
  for (const id of ['respaldos', 'privilegios-formulario', 'auditoria', 'apariencia']) {
    assert.match(drawer, new RegExp(`id: '${id}'`), `drawer article ${id}`);
    assert.ok(articles.some(([f]) => f === `${id}.md`), `markdown ${id}.md`);
  }
  assert.match(drawer, /Respaldos y restauración/);
  assert.match(drawer, /Visible y editable/);
  assert.match(drawer, /Verificar integridad/);
  assert.match(drawer, /URL del Logotipo/);
});

test('existing article ids are preserved', () => {
  for (const id of ['ocr', 'workflows', 'expedientes', 'usuarios-roles', 'primer-uso']) {
    assert.match(drawer, new RegExp(`id: '${id}'`));
  }
});

test('assistant manual covers backups, privileges, audit, appearance, signup/plans and login lockout', () => {
  for (const re of [/\/settings\/backups/, /backup:restore/, /nombre de la organización/i, /Visible y editable/, /Solo lectura/, /No visible/,
    /Verificar integridad/, /\/settings\/appearance/, /\/planes/, /intentos fallidos/i]) {
    assert.match(manual, re);
  }
  assert.ok(manual.length < 20000, 'manual stays small enough to embed in every prompt');
});

test('embedded drawer articles match the markdown files', () => {
  for (const [file, text] of articles) {
    const id = file.replace(/\.md$/, '');
    const m = drawer.match(new RegExp(`id: '${id}',[\\s\\S]*?content: \`\\n([\\s\\S]*?)\\n    \`,`));
    assert.ok(m, `embedded content for ${id}`);
    assert.equal(m[1].replace(/\\`/g, '`').trim(), text.trim(), id);
  }
});

test('the dead Botpress branch is gone but the assistant:open event stays', () => {
  assert.doesNotMatch(drawer, /botpress/i);
  assert.match(drawer, /'assistant:open'/);
});
