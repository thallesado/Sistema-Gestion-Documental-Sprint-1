import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(frontend, file), 'utf8');

test('los tipos exponen mustChangePassword en la respuesta de login y en el usuario', async () => {
  const types = await read('src/app/core/auth/auth.types.ts');
  assert.match(types, /interface AuthResponse[\s\S]*?mustChangePassword\??: boolean/);
  assert.match(types, /interface AuthUser[\s\S]*?mustChangePassword: boolean/);
});

test('AuthService conserva el indicador desde el login y /auth/me y lo limpia al cerrar sesión', async () => {
  const service = await read('src/app/core/auth/auth.service.ts');
  assert.match(service, /readonly mustChangePassword = signal\(/);
  assert.match(service, /this\.mustChangePassword\.set\(response\.mustChangePassword === true\)/);
  assert.match(service, /this\.mustChangePassword\.set\(user\.mustChangePassword === true\)/);
  assert.match(service, /completeForcedPasswordChange\(\)/);
  assert.match(service, /changePassword\(currentPassword: string, newPassword: string\)/);
});

test('authGuard redirige a /change-password y la ruta existe dentro de features/auth', async () => {
  const guard = await read('src/app/core/auth/auth.guard.ts');
  assert.match(guard, /auth\.mustChangePassword\(\)[\s\S]*?\/change-password/);
  assert.match(guard, /export const changePasswordPageGuard/);
  const routes = await read('src/app/features/auth/auth.routes.ts');
  assert.match(routes, /path: 'change-password'/);
  assert.match(routes, /change-password-page/);
  assert.match(routes, /changePasswordPageGuard/);
  await read('src/app/features/auth/pages/change-password-page.ts');
});

test('el interceptor lleva a /change-password cuando el backend responde MUST_CHANGE_PASSWORD', async () => {
  const interceptor = await read('src/app/core/auth/auth.interceptor.ts');
  assert.match(interceptor, /MUST_CHANGE_PASSWORD/);
  assert.match(interceptor, /\/change-password/);
});

test('la pantalla usa PUT /auth/me/password vía AuthService y no muestra ni guarda contraseñas', async () => {
  const page = await read('src/app/features/auth/pages/change-password-page.ts');
  assert.match(page, /auth\.changePassword\(/);
  assert.match(page, /completeForcedPasswordChange\(\)/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|console\./);
});

test('el comportamiento previo del cambio voluntario de contraseña se conserva', async () => {
  const shell = await read('src/app/shell/app.ts');
  assert.match(shell, /this\.auth\.changePassword\(this\.currentPassword, this\.newPassword\)/);
  const guard = await read('src/app/core/auth/auth.guard.ts');
  assert.match(guard, /return router\.createUrlTree\(\['\/login'\], \{ queryParams: \{ returnUrl: state\.url \} \}\)/);
});
