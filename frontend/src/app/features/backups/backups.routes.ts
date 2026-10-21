import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { authGuard } from '../../core/auth/auth.guard';

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
    // The backend checks fresh tenant permissions for every operation.
    canActivate: [authGuard],
  },
];
