import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../src/app/features/document-operations/mail-intake-page.ts', import.meta.url), 'utf8');

test('textos del buzón con tildes y signos correctos', () => {
  for (const wrong of ['Retencion de', '(dias)', 'devolver a revision', 'OCR envia', 'extraidos', 'conciliacion despues', 'minimo 5', 'se enviara a Google', '?Autorizas este envio?']) {
    assert.ok(!page.includes(wrong), `texto sin tilde: ${wrong}`);
  }
  assert.ok(page.includes('¿Autorizas este envío?'));
});

test('resultados del análisis y códigos de error se muestran traducidos', () => {
  assert.ok(!page.includes("{{r['scan_result']}}"), 'scan_result se muestra en crudo');
  assert.ok(!page.includes("{{c['error_code']}}"), 'error_code de la conexión se muestra en crudo');
  for (const code of ['CLEAN', 'MALWARE_DETECTED', 'SCANNER_UNAVAILABLE', 'REJECTED_TYPE', 'MAILBOX_CONNECTION_FAILED']) {
    assert.match(page, new RegExp(`\\b${code}:'`), `falta etiqueta para ${code}`);
  }
});

test('el enlace a Digitalización OCR y la vista previa respetan lo que acepta el backend', () => {
  assert.match(page, /@if\(can\('ocr:create'\)\)\{<a routerLink="\/digitization">/);
  // MailIntakeService.preview solo sirve pdf, png y jpeg.
  assert.match(page, /previewable\(r\)/);
});

test('el historial de entregas muestra el resultado traducido', async () => {
  const deliveries = await readFile(new URL('../src/app/features/document-operations/external-deliveries-page.ts', import.meta.url), 'utf8');
  assert.ok(!deliveries.includes("{{e['result']}}"));
  assert.match(deliveries, /SUCCESS:'Correcto',FAILURE:'Fallido'/);
});
