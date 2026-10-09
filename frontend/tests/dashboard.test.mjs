import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

const [workspaceApi, workspacePage, dashboardController] = await Promise.all([
  read('frontend/src/app/core/api/workspace-api.service.ts'),
  read('frontend/src/app/features/tablero/pages/espacio-trabajo-page.ts'),
  read('backend/bootstrap/src/main/java/com/lta/gestdocum/backend/controller/DashboardController.java'),
]);

test('WorkspaceApiService connects to /api/v1/dashboard with typed response', () => {
  assert.match(workspaceApi, /dashboard\(limit = 10\): Observable<DashboardResponse>/);
  assert.match(workspaceApi, /\$\{API_URL\}\/dashboard/);
  assert.match(workspaceApi, /export interface DashboardResponse/);
  assert.match(workspaceApi, /recentActivity: ApiActivity\[\]/);
  assert.match(workspaceApi, /recentDocuments: ApiDashboardDocument\[\]/);
});

test('WorkspacePage connects loadDashboard to real workspaceApi.dashboard without static fake task fallback', () => {
  assert.match(workspacePage, /this\.workspaceApi\.dashboard\(10\)\.subscribe/);
  assert.match(workspacePage, /this\.tasks\.set\(response\.tasks \|\| \[\]\)/);
  assert.match(workspacePage, /this\.activities\.set\(response\.recentActivity \|\| \[\]\)/);
  // Ensure the old mock tasks aren't injected into fallback
  assert.doesNotMatch(workspacePage, /Revisión técnica de contrato marco/);
  assert.doesNotMatch(workspacePage, /Aprobación de orden de compra #892/);
});

test('DashboardController allows any authenticated tenant user to access the dashboard', () => {
  assert.match(dashboardController, /@PreAuthorize\("isAuthenticated\(\)"\)/);
  assert.doesNotMatch(dashboardController, /hasAuthority\('task:read'\)/);
  assert.doesNotMatch(dashboardController, /hasAnyAuthority\('audit:read_tenant','audit:read_global'\)/);
});
