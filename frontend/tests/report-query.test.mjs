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
