import { Routes } from '@angular/router';
import { authGuard, hasPermissionGuard } from '../../core/auth/auth.guard';

export const settingsRoutes: Routes = [
  {
    path: 'settings/general',
    pathMatch: 'full',
    redirectTo: '/settings',
  },
  {
    path: 'settings/appearance',
    loadComponent: () => import('./pages/appearance-page').then((m) => m.AppearancePage),
    title: 'Apariencia - NexoDocs',
    canActivate: [authGuard, hasPermissionGuard(['tenant:update', 'tenant:manage'])],
  },
];
