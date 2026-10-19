import { Routes } from '@angular/router';
import { authGuard, hasPermissionGuard, platformAdminGuard, userAdminGuard } from '../../core/auth/auth.guard';

export const administracionRoutes: Routes = [
  {
    path: 'users',
    loadComponent: () => import('./pages/administracion-page').then((m) => m.AdministrationPage),
    title: 'Usuarios del tenant - NexoDocs',
    canActivate: [authGuard, userAdminGuard],
  },
  {
    path: 'users/form-privileges',
    loadComponent: () => import('./pages/privilegios-formulario-page').then((m) => m.FormPrivilegesPage),
    title: 'Privilegios por formulario - NexoDocs',
    canActivate: [authGuard, hasPermissionGuard('component_permission:manage')],
  },
  {
    path: 'access-denied',
    loadComponent: () => import('../no-encontrado/pages/access-denied-page').then((m) => m.AccessDeniedPage),
    title: 'Acceso restringido - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'tenants',
    loadComponent: () => import('./pages/administracion-page').then((m) => m.AdministrationPage),
    title: 'Tenants - NexoDocs',
    canActivate: [platformAdminGuard],
  },
  {
    path: 'tenants/new',
    loadComponent: () => import('./pages/administracion-page').then((m) => m.AdministrationPage),
    title: 'Crear tenant - NexoDocs',
    canActivate: [platformAdminGuard],
  },
];

export { administracionRoutes as administrationRoutes };
