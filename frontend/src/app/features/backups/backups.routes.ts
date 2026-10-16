import { Routes } from '@angular/router';
import { authGuard, userAdminGuard } from '../../core/auth/auth.guard';

export const backupsRoutes: Routes = [
  {
    path: 'settings/backups',
    loadComponent: () => import('./pages/backups-page').then((m) => m.BackupsPage),
    title: 'Respaldos - NexoDocs',
    canActivate: [authGuard, userAdminGuard],
  },
];
