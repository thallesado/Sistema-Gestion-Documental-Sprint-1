import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const clinicoRoutes: Routes = [
  {
    path: 'clinical/patients',
    loadComponent: () => import('./pages/pacientes-page').then((m) => m.PacientesPage),
    title: 'Pacientes - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'clinical/history',
    loadComponent: () => import('./pages/antecedentes-page').then((m) => m.AntecedentesPage),
    title: 'Antecedentes - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'clinical/notes',
    loadComponent: () => import('./pages/notas-medicas-page').then((m) => m.NotasMedicasPage),
    title: 'Notas Médicas - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'expedients/clinical',
    loadComponent: () => import('./pages/clinico-page').then((m) => m.ClinicalPage),
    title: 'Expediente clínico - NexoDocs',
    data: {
      routeInfo: { module: 'Expedientes', subcategory: 'Expediente clínico', href: '/expedients/clinical' },
      mode: 'records',
    },
    canActivate: [authGuard],
  },
  {
    path: 'expedients/clinical/notes',
    loadComponent: () => import('./pages/clinico-page').then((m) => m.ClinicalPage),
    title: 'Notas médicas - NexoDocs',
    data: {
      routeInfo: { module: 'Expedientes', subcategory: 'Notas médicas', href: '/expedients/clinical/notes' },
      mode: 'notes',
    },
    canActivate: [authGuard],
  },
];

export { clinicoRoutes as clinicalRoutes };
