import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const [ocrApi, ocrController, ocrService, workspacePage] = await Promise.all([
  read('frontend/src/app/core/api/ocr-api.service.ts'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/OcrController.java'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/service/OcrService.java'),
  read('frontend/src/app/features/tablero/pages/espacio-trabajo-page.ts'),
]);

test('OcrApiService sends file via multipart/form-data to /api/v1/ocr/process', () => {
  assert.match(ocrApi, /processFile\(file: File\): Observable<OcrProcessResult>/);
  assert.match(ocrApi, /formData\.append\('file', file\)/);
  assert.match(ocrApi, /\$\{API_URL\}\/process/);
});

test('OcrController exposes POST /api/v1/ocr/process with RBAC authority', () => {
  assert.match(ocrController, /@PostMapping\(value = "\/process"/);
  assert.match(ocrController, /@PreAuthorize\("hasAnyAuthority\('ocr:create', 'document:create', 'document:update', 'patient:create'\)"\)/);
  assert.match(ocrController, /processDocument\(file\)/);
});

test('OcrService connects to Gemini Vision API with structured medical prompt and fallback', () => {
  assert.match(ocrService, /gemini-3.8-flash/);
  assert.match(ocrService, /Actúa como un motor de OCR y extracción clínica de grado médico/);
  assert.match(ocrService, /buildFallbackResponse/);
});

test('WorkspacePage connects startOcr to real ocrApi.processFile and renders extracted clinical fields', () => {
  assert.match(workspacePage, /this\.ocrApi\.processFile\(file\)\.subscribe/);
  assert.match(workspacePage, /get ocrData\(\) \{ return this\.ocrApi\.ocrData; \}/);
  assert.match(workspacePage, /ocrData\(\)\?\.structuredFields\?\.length/);
  assert.match(workspacePage, /Valores Clínicos \/ Parámetros Extraídos/);
  assert.match(ocrApi, /this\.ocrData\.set\(result\)/);
});
