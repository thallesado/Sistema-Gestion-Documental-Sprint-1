import { Routes } from '@angular/router';
import { authGuard, hasPermissionGuard } from '../../core/auth/auth.guard';

export const settingsRoutes: Routes = [
  {
    // Portada de Configuración: accesos según permisos y manual de uso. Abierta a cualquier sesión
    // porque el menú de usuario enlaza aquí; cada tarjeta solo aparece si su destino se puede abrir.
    path: 'settings',
    pathMatch: 'full',
    loadComponent: () => import('./pages/settings-home-page').then((m) => m.SettingsHomePage),
    title: 'Configuración - NexoDocs',
    canActivate: [authGuard],
  },
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
