import { Routes } from '@angular/router';
import { navigationRoutes } from '../data/nexodocs-data';
import { authGuard } from '../auth/auth.guard';
import { autenticacionRoutes } from '../../features/auth/auth.routes';
import { clinicoRoutes } from '../../features/clinico/clinico.routes';
import { administracionRoutes } from '../../features/users/users.routes';
import { documentosRoutes } from '../../features/documentos/documentos.routes';
import { expedientesRoutes } from '../../features/expedientes/expedientes.routes';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);
const documentPaths = new Set(['documents', 'documents/mine', 'documents/shared', 'documents/new', 'documents/upload', 'settings/statuses']);
const expedientPaths = new Set(['expedientes', 'expedients', 'expedientes/new', 'expedientes/active', 'expedients/closed', 'expedients/archived']);

const dynamicCatalogRoutes: Routes = navigationRoutes
  .filter((route) => !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
  .map((route) => ({
    path: route.href === '/' ? '' : route.href.slice(1),
    loadComponent: () => {
      if (route.module === 'Reportes') {
        return import('../../features/reportes/pages/reportes-page').then((m) => m.ReportsPage);
      }
      if (route.module === 'Auditoria') {
        return import('../../features/auditoria/pages/auditoria-page').then((m) => m.AuditPage);
      }
      if (route.module === 'Módulo Clínico' && route.subcategory === 'Antecedentes') {
        return import('../../features/clinical/clinical-history-page').then((m) => m.ClinicalHistoryPage);
      }
      return import('../../features/tablero/pages/espacio-trabajo-page').then((m) => m.WorkspacePage);
    },
    title: `${route.subcategory} - NexoDocs`,
    data: { routeInfo: route },
    canActivate: [authGuard],
  }));

export const routes: Routes = [
  ...autenticacionRoutes,
  ...clinicoRoutes,
  ...administracionRoutes,
  ...documentosRoutes,
  ...expedientesRoutes,
  ...dynamicCatalogRoutes,
  {
    path: '**',
    loadComponent: () => import('../../features/no-encontrado/pages/no-encontrado-page').then((m) => m.NotFoundPage),
    title: 'Pagina no encontrada - NexoDocs',
  },
];
