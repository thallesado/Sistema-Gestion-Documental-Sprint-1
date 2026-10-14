import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStatCards, changedMetadata, routeForStatus, statusLabel } from '../src/app/core/utils/ocr-flow.ts';

const stats = (overrides = {}) => ({
  engineConfigured: true, total: 6, successful: 5, failed: 1, indexed: 1, reviewed: 3, accepted: 2, rejected: 1,
  acceptanceRate: 2 / 3, averageConfidence: 0.78, averageProcessingSeconds: 2.4, ...overrides,
});

test('stat cards show measured values from the API', () => {
  const [digitalizaciones, aceptacion, tiempo] = buildStatCards(stats(), 'ready');
  assert.deepEqual(digitalizaciones, { label: 'Digitalizaciones', value: '6', detail: '1 indexadas en el repositorio' });
  assert.equal(aceptacion.value, '66.7%');
  assert.equal(aceptacion.detail, '2 de 3 extracciones revisadas');
  assert.equal(aceptacion.note, 'Confianza media del modelo (autodeclarada): 78%');
  assert.deepEqual(tiempo, { label: 'Tiempo promedio de procesamiento', value: '2.4 s', detail: 'Solo extracciones exitosas' });
});

test('without data the cards show a dash and say so, never an invented figure', () => {
  const empty = buildStatCards(stats({ total: 0, successful: 0, failed: 0, indexed: 0, reviewed: 0, accepted: 0, rejected: 0,
    acceptanceRate: null, averageConfidence: null, averageProcessingSeconds: null }), 'ready');
  assert.equal(empty[0].value, '0');
  assert.equal(empty[0].detail, 'Sin digitalizaciones aún');
  assert.equal(empty[1].value, '—');
  assert.equal(empty[1].detail, 'Sin revisiones aún');
  assert.equal(empty[1].note, undefined);
  assert.equal(empty[2].value, '—');
  assert.equal(empty[2].detail, 'Sin extracciones exitosas aún');
});

test('while loading or after an error the cards show a dash with the reason', () => {
  const loading = buildStatCards(null, 'loading');
  assert.ok(loading.every((card) => card.value === '—' && card.detail === 'Cargando métricas...'));
  const failed = buildStatCards(null, 'error');
  assert.ok(failed.every((card) => card.value === '—' && card.detail === 'No se pudieron cargar las métricas'));
});

test('routeForStatus resumes a stored digitization at the first pending step', () => {
  assert.equal(routeForStatus('REQUIRES_VALIDATION'), '/digitization/ocr');
  assert.equal(routeForStatus('VALIDATED'), '/digitization/indexing');
  assert.equal(routeForStatus('INDEXED'), '/digitization/metadata');
  for (const status of ['FAILED', 'REJECTED', 'PROCESSING', 'QUEUED']) assert.equal(routeForStatus(status), null, status);
});

test('statusLabel gives a Spanish label for every status', () => {
  assert.equal(statusLabel('REQUIRES_VALIDATION'), 'Por validar');
  assert.equal(statusLabel('FAILED'), 'Fallida');
  assert.equal(statusLabel('REJECTED'), 'Rechazada');
  assert.equal(statusLabel('INDEXED'), 'Indexada');
  assert.equal(statusLabel('IDLE'), 'Sin documento');
});

test('changedMetadata sends only fields the reviewer changed', () => {
  const current = { documentType: 'LABORATORIO', patientName: 'Ana Perez', patientDocumentNumber: '123', doctorName: null, issueDate: '2026-10-01' };
  assert.deepEqual(changedMetadata({ patientName: 'Ana María Pérez', documentType: 'LABORATORIO' }, current), { patientName: 'Ana María Pérez' });
  assert.deepEqual(changedMetadata({ doctorName: ' Dr. Soto ' }, current), { doctorName: 'Dr. Soto' });
  assert.deepEqual(changedMetadata({ patientName: '   ', issueDate: '' }, current), {}, 'blank means no change');
  assert.deepEqual(changedMetadata({}, current), {});
});

import { personLabels, reviewWarning } from '../src/app/core/utils/ocr-flow.ts';

test('reviewWarning flags non-clinical documents and low confidence, and stays quiet otherwise', () => {
  assert.match(reviewWarning({ documentType: 'OTRO', confidence: 0.9 }), /no parece un documento clínico/i);
  assert.match(reviewWarning({ documentType: 'LABORATORIO', confidence: 0.4 }), /confianza del modelo es baja/i);
  assert.match(reviewWarning({ documentType: 'OTRO', confidence: 0.3 }), /no parece un documento clínico/i);
  assert.equal(reviewWarning({ documentType: 'LABORATORIO', confidence: 0.9 }), null);
  assert.equal(reviewWarning({ documentType: 'RECETA', confidence: null }), null);
  assert.equal(reviewWarning(null), null);
});

test('personLabels avoids clinical wording when the document is not clinical', () => {
  assert.deepEqual(personLabels('LABORATORIO'), { patient: 'Paciente', doctor: 'Médico' });
  assert.deepEqual(personLabels('RECETA'), { patient: 'Paciente', doctor: 'Médico' });
  assert.deepEqual(personLabels('OTRO'), { patient: 'Persona mencionada', doctor: 'Firmante u otra persona' });
  assert.deepEqual(personLabels(null), { patient: 'Paciente', doctor: 'Médico' });
});
