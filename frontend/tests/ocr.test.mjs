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
  assert.match(ocrController, /@PreAuthorize\(CAN_RUN_OCR\)/);
  assert.match(ocrController, /CAN_RUN_OCR =\s*"hasAnyAuthority\('ocr:create', 'document:create', 'document:update', 'patient:create'\)"/);
  assert.match(ocrController, /jobService\.process\(file\)/);
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
  assert.match(ocrApi, /this\.ocrData\.set\(job\)/);
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

test('OcrController exposes the job lifecycle with the right authority on each step', () => {
  assert.match(ocrController, /@GetMapping\("\/jobs"\)\s*@PreAuthorize\(CAN_READ_OCR\)/);
  assert.match(ocrController, /@GetMapping\("\/jobs\/\{id\}"\)\s*@PreAuthorize\(CAN_READ_OCR\)/);
  assert.match(ocrController, /@GetMapping\("\/stats"\)\s*@PreAuthorize\(CAN_READ_OCR\)/);
  assert.match(ocrController, /@PostMapping\("\/jobs\/\{id\}\/validate"\)\s*@PreAuthorize\(CAN_REVIEW_OCR\)/);
  assert.match(ocrController, /@PostMapping\("\/jobs\/\{id\}\/reject"\)\s*@PreAuthorize\(CAN_REVIEW_OCR\)/);
  assert.match(ocrController, /@PostMapping\("\/jobs\/\{id\}\/index"\)\s*@PreAuthorize\(CAN_INDEX_OCR\)/);
  assert.match(ocrController, /@PatchMapping\("\/jobs\/\{id\}\/metadata"\)\s*@PreAuthorize\(CAN_REVIEW_OCR\)/);
  assert.match(ocrController, /CAN_INDEX_OCR = "hasAuthority\('document:create'\)"/);
});

test('the Digitalización screen has no hardcoded statistics or fake engine status', () => {
  assert.doesNotMatch(workspacePage, /<strong>142<\/strong>/);
  assert.doesNotMatch(workspacePage, /98\.4%/);
  assert.doesNotMatch(workspacePage, /&lt; 1\.8s/);
  assert.doesNotMatch(workspacePage, /Gemini 3\.8 Flash\)/);
  assert.match(workspacePage, /\{\{ statCards\(\)\[0\]\.value \}\}/);
  assert.match(workspacePage, /\{\{ statCards\(\)\[1\]\.value \}\}/);
  assert.match(workspacePage, /\{\{ statCards\(\)\[2\]\.value \}\}/);
  assert.match(workspacePage, /@if \(ocrStats\(\)\?\.engineConfigured === true\) \{\s*<span class="ocr-engine ocr-engine-on"><i><\/i> Motor OCR Activo/);
  assert.match(workspacePage, /Motor OCR sin configurar/);
  assert.match(workspacePage, /this\.ocrApi\.loadStats\(\);\s*this\.ocrApi\.loadRecent\(\);/);
  assert.match(workspacePage, /Digitalizaciones recientes/);
});

test('validate, reject, index and metadata correction call the backend instead of faking the status', () => {
  assert.match(workspacePage, /this\.ocrApi\.validate\(\)\.subscribe/);
  assert.match(workspacePage, /this\.ocrApi\.reject\(\)\.subscribe/);
  assert.match(workspacePage, /this\.ocrApi\.index\(\{/);
  assert.match(workspacePage, /this\.ocrApi\.updateMetadata\(changes\)\.subscribe/);
  assert.doesNotMatch(workspacePage, /ocrStatus\.set\('(VALIDATED|INDEXED|IDLE)'\)/);
  assert.doesNotMatch(workspacePage, /useScannerStub|Escáner conectado \(stub/);
  assert.match(ocrApi, /\/jobs\/\$\{job\.id\}\/\$\{path\}/);
  assert.match(ocrApi, /finalize\(\(\) => this\.ocrBusy\.set\(false\)\)/);
});

test('a FAILED digitization is shown as an error, never as a result', () => {
  assert.match(ocrApi, /if \(job\.status === 'FAILED'\) \{[^}]*this\.ocrStatus\.set\('ERROR'\);[^}]*this\.ocrError\.set\(job\.errorMessage/s);
  assert.match(workspacePage, /job\.status === 'FAILED'\s*\?\s*\(this\.ocrError\(\)/);
});

test('step buttons are disabled when the digitization is not in the state that step needs', () => {
  assert.match(workspacePage, /\(click\)="validateOcr\(\)" \[disabled\]="ocrStatus\(\) !== 'REQUIRES_VALIDATION' \|\| ocrBusy\(\)"/);
  assert.match(workspacePage, /\(click\)="indexOcr\(\)" \[disabled\]="ocrStatus\(\) !== 'VALIDATED' \|\| !indexTypeId\(\) \|\| ocrBusy\(\)"/);
  assert.match(workspacePage, /\(click\)="correctMetadata\(\)" \[disabled\]="!canCorrectMetadata\(\) \|\| ocrBusy\(\)"/);
  assert.match(workspacePage, /No hay una digitalización abierta/);
});

test('mobile hero-banner rules are scoped to the OCR screens so other modules keep their layout', () => {
  assert.match(styles, /\.module-hero-banner\.ocr-hero \{ align-items: flex-start; flex-direction: column;/);
  assert.doesNotMatch(styles, /@media \(max-width: 620px\) \{[^}]*\n  \.module-hero-banner \{/);
  assert.equal((workspacePage.match(/class="module-hero-banner ocr-hero"/g) || []).length, 2);
});

test('the OCR screen warns about non-clinical or low-confidence results and does not call everyone a patient', () => {
  assert.match(workspacePage, /@if \(reviewNotice\(\); as notice\) \{\s*<div class="ocr-warning" role="status">/);
  assert.match(workspacePage, /readonly reviewNotice = computed\(\(\) => reviewWarning\(this\.ocrApi\.ocrData\(\)\)\);/);
  assert.match(workspacePage, /\{\{ labels\(\)\.patient \}\}<\/dt>/);
  assert.match(workspacePage, /\{\{ labels\(\)\.doctor \}\}<\/dt>/);
  assert.doesNotMatch(workspacePage, /margin: 0;">Paciente<\/dt>/);
  assert.match(styles, /\.ocr-warning \{/);
});
