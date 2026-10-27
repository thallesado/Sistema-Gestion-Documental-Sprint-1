import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const audit = (args) => JSON.parse(execFileSync(process.execPath, ['scripts/i18n-audit.mjs', ...args, '--json'], { cwd: frontend, encoding: 'utf8' }));

/** Pantallas revisadas: Respaldos, Permisos, Gestionar suscripción y pago, Reportes, Apariencia, Configuración y bienvenida. */
const SCREENS = [
  'src/app/features/backups/pages/backups-page.html', 'src/app/features/backups/pages/backups-page.ts',
  'src/app/features/users/components/permission-detail-modal.ts', 'src/app/features/users/components/permissions-catalog.ts',
  'src/app/features/billing/pages/subscription-page.ts', 'src/app/features/billing/pages/checkout-page.ts',
  'src/app/features/billing/pages/billing-page.ts', 'src/app/features/reportes/pages/reportes-page.ts',
  'src/app/features/reportes/components/export-dropdown.ts', 'src/app/features/reportes/components/report-table.ts',
  'src/app/core/data/report-data.ts', 'src/app/features/settings/pages/appearance-page.ts',
  'src/app/features/settings/pages/settings-home-page.ts', 'src/app/features/marketing/pages/welcome-page.ts',
  'src/app/features/marketing/components/site-header.ts',
];

for (const language of ['en', 'fr', 'zh']) {
  test(`los textos fijos de las pantallas revisadas están traducidos (${language})`, () => {
    const missing = audit([...SCREENS, `--lang=${language}`]).filter((row) => row.status === 'missing');
    assert.deepEqual(missing.map((row) => `${path.basename(row.file)}: ${row.text}`), []);
  });
}

test('la web pública tiene sus claves en los cuatro idiomas', () => {
  const output = execFileSync(process.execPath, ['scripts/i18n-audit.mjs', '--keys',
    'src/app/features/marketing/pages/welcome-page.ts', 'src/app/features/marketing/pages/about-page.ts',
    'src/app/features/marketing/pages/contact-page.ts', 'src/app/features/marketing/components/site-header.ts',
    'src/app/features/marketing/components/site-footer.ts'], { cwd: frontend, encoding: 'utf8' });
  assert.match(output, /claves sin traducir: 0/);
});

test('las frases con datos variables se traducen como aparecen en pantalla', () => {
  const samples = [
    'Plan Profesional', 'Plan Profesional · $79.00 / mes', 'Hasta 50 usuarios', 'Próxima renovación: 27 nov 2026',
    'Cambio a PRO programado para el 26 nov 2026', '12 respaldos', 'Etapa: VALIDATING', '3 de 40 permisos',
    'Desde el 26 nov 2026 pasarás al plan BASIC (mensual); el siguiente pago ya será por ese plan.',
    'Conservas el acceso hasta el 26 nov 2026. Después la organización queda cancelada y sus datos se eliminan a los 30 días.',
    'Mejorar a Empresarial', 'Tu plan ahora es Empresarial.', 'ahorra $158', '7 eventos', 'Detalle de Ventas',
  ];
  const translate = (language) => JSON.parse(execFileSync(process.execPath,
    ['scripts/i18n-audit.mjs', '--translate', `--lang=${language}`, ...samples], { cwd: frontend, encoding: 'utf8' }));
  const result = Object.fromEntries(['en', 'fr', 'zh'].map((language) => [language, translate(language)]));
  for (const [language, values] of Object.entries(result)) {
    values.forEach((translated, index) => assert.notEqual(translated, samples[index], `${language}: ${samples[index]}`));
  }
  assert.equal(result.en[0], 'Professional plan');
  assert.equal(result.en[1], 'Professional plan · $79.00 / month');
  assert.equal(result.fr[3], 'Prochain renouvellement : 27 nov 2026');
});
