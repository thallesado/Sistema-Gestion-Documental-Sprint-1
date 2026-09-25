import { Routes } from '@angular/router';
import { authGuard, platformAdminGuard } from '../../core/auth/auth.guard';

export const administracionRoutes: Routes = [
  {
    path: 'users',
    loadComponent: () => import('./administracion-page').then((m) => m.AdministrationPage),
    title: 'Usuarios del tenant - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'users/new',
    loadComponent: () => import('./administracion-page').then((m) => m.AdministrationPage),
    title: 'Crear usuario - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'access-denied',
    loadComponent: () => import('../no-encontrado/access-denied-page').then((m) => m.AccessDeniedPage),
    title: 'Acceso restringido - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'tenants',
    loadComponent: () => import('./administracion-page').then((m) => m.AdministrationPage),
    title: 'Tenants - NexoDocs',
    canActivate: [platformAdminGuard],
  },
  {
    path: 'tenants/new',
    loadComponent: () => import('./administracion-page').then((m) => m.AdministrationPage),
    title: 'Crear tenant - NexoDocs',
    canActivate: [platformAdminGuard],
  },
];

export { administracionRoutes as administrationRoutes };
