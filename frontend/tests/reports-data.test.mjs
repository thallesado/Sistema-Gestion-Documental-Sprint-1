import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  cellText,
  chartPointsFromRows,
  finiteNumber,
  groupLabel,
  reportDefinition,
  sessionLabels,
} from '../src/app/core/data/report-data.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

test('finiteNumber never returns NaN or Infinity', () => {
  assert.equal(finiteNumber('abc'), 0);
  assert.equal(finiteNumber(undefined, 7), 7);
  assert.equal(finiteNumber(NaN, 3), 3);
  assert.equal(finiteNumber(Infinity), 0);
  assert.equal(finiteNumber('12.5'), 12.5);
  assert.equal(finiteNumber(4), 4);
});

test('chartPointsFromRows counts rows by label for string columns (area, user, date, stage)', () => {
  const rows = [
    { area: 'Legal', date: '2026-09-10', stage: 'Revisión', user: 'Laura', actions: 4 },
    { area: 'Legal', date: '2026-09-10', stage: 'Inicial', user: 'Carlos', actions: 2 },
    { area: 'Dirección', date: '2026-09-11', stage: 'Revisión', user: 'Laura', actions: 1 },
  ];
  for (const column of ['area', 'date', 'stage', 'user']) {
    const points = chartPointsFromRows(rows, column);
    assert.ok(points.every((p) => Number.isFinite(p.value)), `${column} has non finite values`);
    assert.equal(points.reduce((sum, p) => sum + p.value, 0), 3);
  }
  assert.deepEqual(chartPointsFromRows(rows, 'area').map((p) => [p.label, p.value]), [['Legal', 2], ['Dirección', 1]]);
});

test('chartPointsFromRows sums a numeric column only when asked and ignores non numeric values', () => {
  const rows = [
    { user: 'Laura', actions: 4 },
    { user: 'Laura', actions: 'x' },
    { user: 'Carlos', actions: 2 },
  ];
  assert.deepEqual(chartPointsFromRows(rows, 'user', 'actions').map((p) => [p.label, p.value]), [['Laura', 5], ['Carlos', 2]]);
});

test('groupLabel truncates timestamps to the day and labels empty values', () => {
  assert.equal(groupLabel('2026-09-10 14:22:01'), '2026-09-10');
  assert.equal(groupLabel('2026-09-10'), '2026-09-10');
  assert.equal(groupLabel(null), 'Sin dato');
  assert.equal(groupLabel('  '), 'Sin dato');
});

test('cellText renders hidden (null) values as a dash', () => {
  assert.equal(cellText(null), '—');
  assert.equal(cellText(undefined), '—');
  assert.equal(cellText(''), '—');
  assert.equal(cellText(0), '0');
  assert.equal(cellText('APPROVED'), 'APPROVED');
});

test('sessionLabels uses the authenticated user and never demo constants', () => {
  assert.deepEqual(sessionLabels(null), { tenant: 'Organización autenticada', role: '' });
  assert.deepEqual(sessionLabels({ tenantName: 'Acme Corp', platformAdmin: false, roleNames: ['Admin', 'Auditor'] }), {
    tenant: 'Acme Corp',
    role: 'Admin, Auditor',
  });
  assert.equal(sessionLabels({ tenantName: null, platformAdmin: true, roleNames: [] }).role, 'Superadministrador');
});

test('report definitions expose the OCR report and the expedient column returned by the API', () => {
  assert.equal(reportDefinition('ocr').key, 'ocr');
  assert.ok(reportDefinition('expedients').columns.some((c) => c.key === 'expedient'));
  assert.equal(reportDefinition('documents').key, 'documents');
});

test('reports page no longer depends on demo state, tenant comparison or the all-tenants selector', async () => {
  const [page, selector, dropdown, api] = await Promise.all([
    read('frontend/src/app/features/reportes/pages/reportes-page.ts'),
    read('frontend/src/app/features/reportes/components/tenant-selector.ts'),
    read('frontend/src/app/features/reportes/components/export-dropdown.ts'),
    read('frontend/src/app/core/api/report-api.service.ts'),
  ]);
  assert.doesNotMatch(page, /DemoSessionState/);
  assert.doesNotMatch(page, /tenantComparison|Comparativo por tenant/);
  assert.doesNotMatch(selector, /Todos los tenants/);
  assert.match(page, /AuthService/);
  assert.doesNotMatch(dropdown, /Exportar a Excel/);
  assert.match(dropdown, /Exportar a CSV \(Excel\)/);
  assert.match(api, /case 'ocr'/);
  assert.match(page, /exportToJson/);
  assert.match(page, /exportToPrintView/);
});

test('report chart guards non finite values before drawing', async () => {
  const chart = await read('frontend/src/app/features/reportes/components/report-chart.ts');
  assert.match(chart, /finiteNumber/);
});
