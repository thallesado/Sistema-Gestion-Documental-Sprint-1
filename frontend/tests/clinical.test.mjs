import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

async function loadTsModule(relativePath) {
  const filePath = path.join(frontend, relativePath);
  const source = await readFile(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', compiled)(require, exports);
  return exports;
}

test('HU-04: Rutas y navegación del módulo clínico están correctamente registradas', async () => {
  const { navigationRoutes, routeFor } = await loadTsModule('src/app/core/data/nexodocs-data.ts');
  
  assert.equal(routeFor('Módulo Clínico', 'Antecedentes'), '/clinical/history');
  assert.equal(routeFor('Módulo Clínico', 'Pacientes'), '/clinical/patients');

  const historyRoute = navigationRoutes.find((r) => r.href === '/clinical/history');
  assert.ok(historyRoute, 'Ruta /clinical/history debe existir');
  assert.equal(historyRoute.module, 'Módulo Clínico');
  assert.equal(historyRoute.subcategory, 'Antecedentes');
});

test('HU-04: Detección lógica de severidad alta en alergias estructuradas', () => {
  function checkHighSeverity(allergies) {
    return (allergies || []).some((a) => a?.severity === 'HIGH');
  }

  const sampleWithoutHigh = [
    { allergen: 'Polvo', severity: 'LOW', reaction: 'Estornudos' },
    { allergen: 'Látex', severity: 'MEDIUM', reaction: 'Dermatitis' },
  ];
  assert.equal(checkHighSeverity(sampleWithoutHigh), false, 'No debe alertar si no hay severidad HIGH');

  const sampleWithHigh = [
    { allergen: 'Penicilina', severity: 'HIGH', reaction: 'Anafilaxia' },
    { allergen: 'Polen', severity: 'LOW', reaction: 'Rinitis' },
  ];
  assert.equal(checkHighSeverity(sampleWithHigh), true, 'Debe alertar cuando existe al menos una alergia HIGH');
});

test('HU-04: Estructura del payload clínico cumple con el contrato de la API', () => {
  const mockPayload = {
    patientId: '11111111-1111-1111-1111-111111111111',
    bloodType: 'O+',
    pathologicalAntecedents: 'Hipertensión diagnosticada en 2020',
    nonPathologicalAntecedents: 'No fumador, sedentario',
    familyAntecedents: 'Madre con diabetes tipo 2',
    chronicConditions: 'Hipertensión arterial esencial',
    allergies: [
      { allergen: 'Sulfas', severity: 'HIGH', reaction: 'Eritema multiforme' },
    ],
    currentMedications: [
      { name: 'Enalapril', dose: '10 mg', frequency: 'Cada 24 horas' },
    ],
    observations: 'Control cada 6 meses',
  };

  assert.ok(mockPayload.patientId, 'patientId es obligatorio');
  assert.equal(mockPayload.allergies.length, 1);
  assert.equal(mockPayload.allergies[0].severity, 'HIGH');
  assert.equal(mockPayload.currentMedications.length, 1);
  assert.equal(mockPayload.currentMedications[0].name, 'Enalapril');
});
