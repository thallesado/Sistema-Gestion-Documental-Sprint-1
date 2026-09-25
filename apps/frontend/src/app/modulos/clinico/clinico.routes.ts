import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const clinicoRoutes: Routes = [
  {
    path: 'expedients/clinical',
    loadComponent: () => import('./clinico-page').then((m) => m.ClinicalPage),
    title: 'Expediente clínico - NexoDocs',
    data: {
      routeInfo: { module: 'Expedientes', subcategory: 'Expediente clínico', href: '/expedients/clinical' },
      mode: 'records',
    },
    canActivate: [authGuard],
  },
  {
    path: 'expedients/clinical/notes',
    loadComponent: () => import('./clinico-page').then((m) => m.ClinicalPage),
    title: 'Notas médicas - NexoDocs',
    data: {
      routeInfo: { module: 'Expedientes', subcategory: 'Notas médicas', href: '/expedients/clinical/notes' },
      mode: 'notes',
    },
    canActivate: [authGuard],
  },
];

export { clinicoRoutes as clinicalRoutes };
