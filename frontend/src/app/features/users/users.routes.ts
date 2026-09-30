import { Routes } from '@angular/router';
import { authGuard, platformAdminGuard, userAdminGuard } from '../../core/auth/auth.guard';

export const administracionRoutes: Routes = [
  {
    path: 'users',
    loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
    title: 'Usuarios del tenant - NexoDocs',
    canActivate: [authGuard, userAdminGuard],
  },
  {
    path: 'access-denied',
    loadComponent: () => import('../../pages/no-encontrado/access-denied/access-denied.page').then((m) => m.AccessDeniedPage),
    title: 'Acceso restringido - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'tenants',
    loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
    title: 'Tenants - NexoDocs',
    canActivate: [platformAdminGuard],
  },
  {
    path: 'tenants/new',
    loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
    title: 'Crear tenant - NexoDocs',
    canActivate: [platformAdminGuard],
  },
];

export { administracionRoutes as administrationRoutes };
