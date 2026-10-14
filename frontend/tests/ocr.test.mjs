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

const [styles, nginxConf] = await Promise.all([
  read('frontend/src/styles.css'),
  read('infrastructure/docker/nginx.conf'),
]);

test('Abrir cámara opens the live viewer and falls back to the file input when the camera API is unavailable', () => {
  assert.match(workspacePage, /\(click\)="openCamera\(\)">Abrir cámara/);
  assert.doesNotMatch(workspacePage, /\(click\)="cameraInput\.click\(\)"/);
  assert.match(workspacePage, /if \(!isCameraSupported\(navigator\)\) \{\s*this\.cameraInput\?\.nativeElement\.click\(\);/);
  assert.match(workspacePage, /<video #cameraVideo class="cam-video" autoplay playsinline muted>/);
  assert.match(workspacePage, /captureFrameToFile\(this\.cameraVideoEl/);
  assert.match(workspacePage, /acceptFile\(file, 'Cámara web'\)/);
});

test('the camera is always released: on close, on destroy and on Escape', () => {
  assert.match(workspacePage, /closeCamera\(\): void \{\s*this\.cameraRequest\+\+;\s*stopStream\(this\.cameraStream\);/);
  assert.match(workspacePage, /ngOnDestroy\(\): void \{\s*this\.cameraRequest\+\+;\s*stopStream\(this\.cameraStream\);/);
  assert.match(workspacePage, /@HostListener\('document:keydown\.escape'\)/);
});

test('OCR page shows an animated loading indicator while processing and a visible error with retry', () => {
  assert.match(workspacePage, /@if \(ocrLoading\(\)\) \{\s*<div class="ocr-loading" role="status"/);
  assert.match(workspacePage, /ocrLoadingMessage\(\)/);
  assert.match(workspacePage, /Tiempo transcurrido: \{\{ ocrElapsed\(\) \}\} s/);
  assert.match(workspacePage, /<div class="ocr-error" role="alert">/);
  assert.match(workspacePage, /\(click\)="startOcr\(\)">Reintentar/);
  assert.match(styles, /@keyframes ocr-spin/);
  assert.match(styles, /@keyframes ocr-slide/);
});

test('failed OCR requests leave PROCESSING, expose the message and always stop the timer', () => {
  assert.match(ocrApi, /this\.ocrStatus\.set\('ERROR'\)/);
  assert.match(ocrApi, /this\.ocrError\.set\(describeOcrError\(err\)\)/);
  assert.match(ocrApi, /finalize\(\(\) => this\.stopElapsedTimer\(\)\)/);
});

test('OCR grid is responsive: no inline grid template overriding the stylesheet breakpoints', () => {
  assert.match(workspacePage, /<div class="ocr-grid">/);
  assert.doesNotMatch(workspacePage, /class="ocr-grid" style=/);
  assert.match(styles, /@media \(max-width: 900px\) \{\s*\.ocr-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test('nginx accepts camera-sized uploads and waits long enough for the multi-model OCR call', () => {
  assert.match(nginxConf, /client_max_body_size 26m;/);
  assert.match(nginxConf, /proxy_read_timeout 120s;/);
});

test('a getUserMedia result that arrives after close, reopen or destroy never leaves the camera on', () => {
  assert.match(workspacePage, /private cameraRequest = 0;/);
  assert.match(workspacePage, /const request = \+\+this\.cameraRequest;/);
  assert.match(workspacePage, /if \(request !== this\.cameraRequest \|\| !this\.cameraOpen\(\)\) \{\s*stopStream\(stream\);/);
  assert.match(workspacePage, /closeCamera\(\): void \{\s*this\.cameraRequest\+\+;/);
  assert.match(workspacePage, /ngOnDestroy\(\): void \{\s*this\.cameraRequest\+\+;/);
});

test('choosing a new file clears a previous ERROR status and the status text covers IDLE and ERROR', () => {
  assert.match(ocrApi, /setFile\(file: File, source: string\): void \{[^}]*if \(this\.ocrStatus\(\) === 'ERROR'\) this\.ocrStatus\.set\('IDLE'\);/);
  assert.match(workspacePage, /=== 'ERROR'[^\n]*'El procesamiento falló/);
  assert.match(workspacePage, /=== 'IDLE'[^\n]*'Sin documento procesado/);
});

test('there is a single loading indicator and capture errors surface inside the camera viewer', () => {
  assert.doesNotMatch(workspacePage, /Procesando visión multimodal con Gemini\.\.\. Extrayendo texto/);
  assert.match(workspacePage, /if \(this\.acceptFile\(file, 'Cámara web'\)\) this\.closeCamera\(\);\s*else this\.cameraError\.set\(this\.actionMessage\);/);
});
