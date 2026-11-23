import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(path.join(frontend, 'src/app/features/reportes/voice/voice-report-query.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
new Function('require', 'exports', compiled)(createRequire(import.meta.url), exports);
const { parseVoiceQuery } = exports;

test('spoken months and relative months resolve to calendar boundaries', () => {
  const now = new Date(2026, 10, 23);
  for (const query of ['documentos creados en el mes de noviembre.', 'documentos de este mes']) {
    assert.deepEqual(parseVoiceQuery(query, now).filters, { dateFrom: '2026-11-01', dateTo: '2026-11-30' });
  }
  assert.deepEqual(parseVoiceQuery('mes pasado', new Date(2026, 0, 3)).filters,
    { dateFrom: '2025-12-01', dateTo: '2025-12-31' });
  assert.deepEqual(parseVoiceQuery('febrero de 2024', now).filters,
    { dateFrom: '2024-02-01', dateTo: '2024-02-29' });
  assert.deepEqual(parseVoiceQuery('entre el 1 de octubre de 2016 y el 31 de octubre de 2026', now).filters,
    { dateFrom: '2016-10-01', dateTo: '2026-10-31' });
  assert.ok(parseVoiceQuery('desde el 31 de febrero de 2026', now).dateError);
  assert.ok(parseVoiceQuery('la semana pasada', now).dateError);
});

test('voice parser returns only supported date, status and area filters', () => {
  const result = parseVoiceQuery('documentos aprobados del área Archivo entre 01/10/2026 y 31/10/2026');
  assert.deepEqual(result.filters, { dateFrom: '2026-10-01', dateTo: '2026-10-31', status: 'APPROVED', area: 'archivo' });
  assert.equal(JSON.stringify(result).includes('documentos aprobados'), false);
});

test('voice parser rejects impossible dates and does not expose unmatched content', () => {
  const result = parseVoiceQuery('paciente secreto 123456, ver desde 31/02/2026 hasta 01/03/2026');
  assert.deepEqual(result.filters, {});
  assert.equal(JSON.stringify(result).includes('secreto'), false);
  assert.equal(JSON.stringify(result).includes('123456'), false);
});
