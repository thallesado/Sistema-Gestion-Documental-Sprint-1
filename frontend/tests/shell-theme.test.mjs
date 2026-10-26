import assert from 'node:assert/strict';
import test from 'node:test';
import { load, read } from './helpers-u4.mjs';

const { themeVariables, THEME_VARIABLE_NAMES, contrastRatio } = await load('src/app/core/theme/theme-variables.ts');

test('sin color de tenant no se escribe ninguna variable (quedan los defaults)', () => {
  assert.deepEqual(themeVariables({}), {});
  assert.deepEqual(themeVariables({ primaryColor: 'red; background:url(x)' }), {});
});

test('el color de marca alimenta los tokens que usa la app y todos son revocables', () => {
  const vars = themeVariables({ primaryColor: '#7a1fa2' });
  for (const name of ['--primary-color', '--primary-hover', '--tenant-teal', '--tenant-teal-strong', '--tenant-mint', '--tenant-sidebar-bg']) {
    assert.match(vars[name], /^#[0-9a-f]{6}$/, name);
    assert.ok(THEME_VARIABLE_NAMES.includes(name), `${name} debe poder limpiarse al cerrar sesion`);
  }
  assert.equal(vars['--primary-color'], '#7a1fa2');
});

test('el texto blanco sobre el color de accion cumple WCAG AA aunque la marca sea clara', () => {
  for (const color of ['#ffee00', '#ffffff', '#087f7b', '#7a1fa2', '#f4c542']) {
    const vars = themeVariables({ primaryColor: color });
    assert.ok(contrastRatio(vars['--tenant-teal'], '#ffffff') >= 4.5, `${color} -> ${vars['--tenant-teal']}`);
    assert.ok(contrastRatio(vars['--tenant-teal-strong'], '#ffffff') >= 4.5);
  }
});

test('los estilos globales y del shell leen los tokens del tenant con el verde como respaldo', async () => {
  for (const file of ['src/styles.css', 'src/app/shell/app.css']) {
    const css = await read(file);
    assert.match(css, /--teal:\s*var\(--tenant-teal,\s*#[0-9a-f]{6}\)/i, file);
    assert.match(css, /--teal-strong:\s*var\(--tenant-teal-strong,/i, file);
  }
  const styles = await read('src/styles.css');
  assert.match(styles, /\.btn-primary-action\s*\{\s*background:\s*var\(--teal\)/);
});

test('el logo guardado en Apariencia se usa en la cabecera del shell', async () => {
  assert.match(await read('src/app/shell/app.ts'), /theme\.settings\(\)\.logoUrl/);
});

test('Apariencia aparece en el menu del admin del tenant sin quitar las demas entradas', async () => {
  const { navigationRoutes } = await load('src/app/core/data/nexodocs-data.ts');
  const appearance = navigationRoutes.find((r) => r.href === '/settings/appearance');
  assert.ok(appearance);
  assert.deepEqual(appearance.permission, ['tenant:update', 'tenant:manage']);
  for (const href of ['/settings', '/settings/document-types', '/settings/security']) {
    assert.ok(navigationRoutes.some((r) => r.href === href), href);
  }
  const data = await read('src/app/core/data/nexodocs-data.ts');
  assert.match(data, /label: 'Apariencia', href: '\/settings\/appearance', sprintEnabled: true/);
});

test('el formato regional sigue zona horaria y formato de fecha del tenant', async () => {
  const stubs = { '@angular/core': { Pipe: () => () => undefined, inject: () => ({}) }, '../theme/theme.service': { ThemeService: class {} } };
  const { formatTenantDate } = await load('src/app/core/i18n/format.pipe.ts', stubs);
  const instant = new Date('2026-03-05T02:30:00Z');
  assert.equal(formatTenantDate(instant, 'America/La_Paz', 'YYYY-MM-DD'), '2026-03-04');
  assert.equal(formatTenantDate(instant, 'UTC', 'DD/MM/YYYY'), '05/03/2026');
  assert.equal(formatTenantDate(instant, 'UTC', 'MM/DD/YYYY', true), '03/05/2026 02:30');
  assert.equal(formatTenantDate(instant, undefined, undefined), '2026-03-04');
});

test('favicon apunta a un icono que existe', async () => {
  const html = await read('src/index.html');
  assert.match(html, /rel="icon"[^>]*href="icon\.svg"/);
  assert.doesNotMatch(html, /favicon\.ico/);
  await read('public/icon.svg');
});

test('el fondo del menu lateral sigue el token de marca y no un color fijo', async () => {
  const css = await read('src/app/shell/app.css');
  const sidebar = css.match(/\.sidebar\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(sidebar, /background-color:\s*var\(--sidebar-bg\)/, 'El menu lateral debe usar --sidebar-bg');
  assert.doesNotMatch(sidebar, /background-color:\s*#0b2524/, 'No debe quedar el verde fijo');
});
