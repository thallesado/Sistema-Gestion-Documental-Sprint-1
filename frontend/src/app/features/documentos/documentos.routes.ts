import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const documentosRoutes: Routes = [
  {
    path: 'documents',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Documentos - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'documents/mine',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Mis documentos - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'documents/shared',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Compartidos conmigo - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'documents/new',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Nuevo documento - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'documents/upload',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Subir archivo - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'settings/statuses',
    loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
    title: 'Estados documentales - NexoDocs',
    canActivate: [authGuard],
  },
];

export { documentosRoutes as documentRoutes };
