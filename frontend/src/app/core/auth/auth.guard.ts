import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const platformAdminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.user()?.platformAdmin === true) {
    return true;
  }
  return router.createUrlTree(['/access-denied'], { queryParams: { returnUrl: state.url } });
};

/** Administración de usuarios/roles: superadministrador de plataforma o administrador de tenant. */
export const userAdminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  const allowed = !!user && (user.platformAdmin === true || (user.roleNames ?? []).some((name) => {
    const role = name.toUpperCase();
    return role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN' || role === 'ADMINISTRADOR DE TENANT';
  }));
  return allowed || router.createUrlTree(['/access-denied'], { queryParams: { returnUrl: state.url } });
};
