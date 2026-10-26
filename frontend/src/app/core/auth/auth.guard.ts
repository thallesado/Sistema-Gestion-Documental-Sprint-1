import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PermissionRequirement } from './permission-rules';
import { PermissionService } from './permission.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    // Con contraseña temporal solo se puede usar la pantalla de cambio obligatorio.
    return auth.mustChangePassword() ? router.createUrlTree(['/change-password']) : true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Pantalla de cambio obligatorio: solo para sesiones con contraseña temporal. */
export const changePasswordPageGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  return auth.mustChangePassword() ? true : router.createUrlTree(['/']);
};

/** Root is the smart entry point: visitors discover the product, members enter their workspace. */
export const rootEntryGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/welcome']);
  // Con contraseña temporal la entrada al espacio de trabajo es la pantalla de cambio obligatorio.
  return auth.mustChangePassword() ? router.createUrlTree(['/change-password']) : true;
};

export const platformAdminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.user()?.platformAdmin === true) {
    return true;
  }
  return router.createUrlTree(['/access-denied'], { queryParams: { returnUrl: state.url } });
};

/**
 * Acceso por permiso de función: `canActivate: [authGuard, hasPermissionGuard('document:create')]`.
 * Con una lista basta cualquiera de los permisos. No sustituye a @PreAuthorize en el backend.
 */
export const hasPermissionGuard = (required: PermissionRequirement): CanActivateFn => (_route, state) => {
  const permissions = inject(PermissionService);
  const router = inject(Router);
  return permissions.can(required)
    || router.createUrlTree(['/access-denied'], { queryParams: { returnUrl: state.url } });
};

/** Administración de usuarios y grupos: cualquier rol con `user:read`, no un nombre de rol fijo. */
export const userAdminGuard: CanActivateFn = hasPermissionGuard('user:read');

/** Rutas públicas (login, recuperar contraseña): un usuario ya autenticado va directo al dashboard. */
export const publicGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
