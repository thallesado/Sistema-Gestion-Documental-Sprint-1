import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const read = (file) => readFile(path.join(frontend, file), 'utf8');

const dataSource = await read('src/app/core/data/nexodocs-data.ts');
const dataExports = {};
new Function('require', 'exports', ts.transpileModule(dataSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(require, dataExports);
const { navSections } = dataExports;
const children = navSections.flatMap((section) => section.items.flatMap((item) =>
  item.children.map((child) => ({ ...child, module: item.label, moduleEnabled: item.sprintEnabled !== false }))));

const [appRoutes, usersRoutes, appTs] = await Promise.all([
  read('src/app/core/routes/app.routes.ts'),
  read('src/app/features/users/users.routes.ts'),
  read('src/app/shell/app.ts'),
]);

const SCAFFOLD_SCREENS = [
  { href: '/settings/backups', file: 'src/app/features/backups/backups.routes.ts', page: 'src/app/features/backups/pages/backups-page.ts' },
  { href: '/settings/appearance', file: 'src/app/features/settings/settings.routes.ts', page: 'src/app/features/settings/pages/appearance-page.ts' },
  { href: '/users/form-permissions', file: 'src/app/features/users/users.routes.ts', page: 'src/app/features/users/pages/form-permissions-page.ts' },
  { href: '/reports/queries', file: 'src/app/features/reportes/reportes-dinamicos.routes.ts', page: 'src/app/features/reportes/qbe/qbe-page.ts' },
  { href: '/reports/voice', file: 'src/app/features/reportes/reportes-dinamicos.routes.ts', page: 'src/app/features/reportes/voice/voice-report-page.ts' },
];

/** Pantallas del andamiaje que su responsable ya implementó (dejan de ser marcadores ocultos). */
const IMPLEMENTED = new Set(['/users/form-permissions']);

test('every scaffold screen has its own route file, a placeholder page and a guard', async () => {
  for (const screen of SCAFFOLD_SCREENS) {
    const routes = await read(screen.file);
    const routePath = screen.href.slice(1);
    assert.match(routes, new RegExp(`path: '${routePath}'`), screen.href);
    assert.match(routes, /canActivate: \[authGuard/, `${screen.href} must be guarded`);
    if (!IMPLEMENTED.has(screen.href)) {
      assert.match(await read(screen.page), /<app-under-construction title="[^"]+" \/>/, screen.page);
    }
  }
});

test('the new menu entries exist but stay hidden until their owner enables them', () => {
  for (const screen of SCAFFOLD_SCREENS.filter((item) => item.href !== '/settings/appearance' && !IMPLEMENTED.has(item.href))) {
    const entry = children.find((child) => child.href === screen.href);
    assert.ok(entry, `${screen.href} is missing from the menu`);
    assert.equal(entry.sprintEnabled, false, `${screen.href} must start hidden`);
  }
});

test('the appearance screen keeps its existing menu entry, now served by its own page', () => {
  const entry = children.find((child) => child.href === '/settings/appearance');
  assert.ok(entry);
  assert.equal(entry.module, 'Configuracion');
  assert.equal(entry.moduleEnabled, false, 'the whole Configuracion group is still hidden');
});

test('the generic catalog does not claim the screens that now have their own page', () => {
  const owned = appRoutes.match(/sprintOwnedPaths = new Set\(\[([^\]]+)\]\)/)[1];
  for (const screen of SCAFFOLD_SCREENS) assert.ok(owned.includes(`'${screen.href.slice(1)}'`), screen.href);
  assert.match(appRoutes, /!sprintOwnedPaths\.has\(route\.href\.slice\(1\)\)/);
  for (const name of ['backupsRoutes', 'settingsRoutes', 'pricingRoutes', 'reportesDinamicosRoutes']) {
    assert.match(appRoutes, new RegExp(`\\.\\.\\.${name},`), name);
  }
  assert.match(usersRoutes, /path: 'users\/form-permissions'[\s\S]*canActivate: \[authGuard, hasPermissionGuard\('component_permission:manage'\)\]/);
});

test('the pricing page is public: no guard, and the shell renders it full screen without sidebar', async () => {
  const pricing = await read('src/app/features/pricing/pricing.routes.ts');
  assert.match(pricing, /path: 'planes'/);
  assert.doesNotMatch(pricing, /canActivate/);
  assert.match(appTs, /PUBLIC_PATHS = \[[^\]]*'\/planes'/);
});

const [appHtml, appConfig] = await Promise.all([
  read('src/app/shell/app.html'),
  read('src/app/core/config/app.config.ts'),
]);

test('the shell mounts the help drawer and the assistant slot once, inside the authenticated layout', () => {
  assert.match(appHtml, /<app-help-drawer \/>\s*<app-assistant-widget \/>\s*@if \(toast\(\)\)/);
  assert.equal((appHtml.match(/<app-help-drawer \/>/g) || []).length, 1);
  assert.match(appTs, /imports: \[[^\]]*HelpDrawer, AssistantWidget\]/);
});

test('the help button opens the help panel instead of showing a toast', () => {
  assert.match(appHtml, /help-btn" aria-label="Ayuda" \(click\)="help\.toggle\(\)"/);
  assert.doesNotMatch(appHtml, /notify\('Centro de ayuda'\)/);
});

test('the shell instantiates the assistant context eagerly and keeps the Botpress widget until task H2 replaces it', () => {
  assert.match(appTs, /private readonly assistantContext = inject\(AssistantContextService\);/);
  assert.match(appTs, /this\.chatbot\.load\(\)/);
});

test('HTTP interceptors: the error recorder is outermost, the timestamp placeholder is innermost and passes requests through', async () => {
  assert.match(appConfig, /withInterceptors\(\[assistantErrorInterceptor, authInterceptor, clientTimestampInterceptor\]\)/);
  const placeholder = await read('src/app/core/http/client-timestamp.interceptor.ts');
  assert.match(placeholder, /\(request, next\) => next\(request\)/);
  const recorder = await read('src/app/core/assistant/assistant-error.interceptor.ts');
  assert.match(recorder, /return throwError\(\(\) => error\)/, 'the recorder must never swallow the error');
  assert.doesNotMatch(recorder, /request\.body|error\.error|headers/, 'bodies and headers never reach the assistant context');
});
