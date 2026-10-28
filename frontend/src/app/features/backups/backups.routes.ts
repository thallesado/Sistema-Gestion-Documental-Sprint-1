import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { authGuard, hasPermissionGuard, platformAdminGuard } from '../../core/auth/auth.guard';

export const backupsRoutes: Routes = [
  ...(isDevMode() ? [{
    path: 'preview/backups',
    loadComponent: () => import('./pages/backups-page').then((m) => m.BackupsPage),
    title: 'Vista previa de Respaldos - NexoDocs',
    canActivate: [authGuard],
  }] : []),
  {
    path: 'settings/backups',
    loadComponent: () => import('./pages/backups-page').then((m) => m.BackupsPage),
    title: 'Respaldos - NexoDocs',
    // The backend still checks fresh tenant permissions for every operation; the guard
    // keeps users without backup:read from reaching the screen at all.
    canActivate: [authGuard, hasPermissionGuard('backup:read')],
  },
  {
    path: 'platform/backups',
    loadComponent: () => import('./pages/platform-backup-page').then((m) => m.PlatformBackupPage),
    title: 'Respaldo de plataforma - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
];
