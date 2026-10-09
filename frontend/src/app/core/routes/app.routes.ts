import { Routes } from '@angular/router';
import { navigationRoutes } from '../data/nexodocs-data';
import { authGuard, userAdminGuard } from '../auth/auth.guard';
import { autenticacionRoutes } from '../../features/auth/auth.routes';
import { clinicoRoutes } from '../../features/clinico/clinico.routes';
import { administracionRoutes } from '../../features/users/users.routes';
import { documentosRoutes } from '../../features/documentos/documentos.routes';
import { expedientesRoutes } from '../../features/expedientes/expedientes.routes';
import { workflowsRoutes } from '../../features/workflows/workflows.routes';

const clinicalPaths = new Set([
  'expedients/clinical',
  'expedients/clinical/history',
  'expedients/clinical/notes',
  'clinical/patients',
  'clinical/history',
  'clinical/notes',
]);
const documentPaths = new Set(['documents', 'documents/mine', 'documents/shared', 'documents/new', 'documents/upload', 'settings/statuses']);
const expedientPaths = new Set(['expedientes', 'expedients', 'expedientes/new', 'expedientes/active', 'expedientes/closed', 'expedientes/archived']);

const dynamicCatalogRoutes: Routes = navigationRoutes
  .filter((route) => route.module !== 'Workflows' && !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
  .map((route) => ({
    path: route.href === '/' ? '' : route.href.slice(1),
    loadComponent: () => {
      if (route.module === 'Reportes') {
        return import('../../features/reportes/pages/reportes-page').then((m) => m.ReportsPage);
      }
      if (route.module === 'Auditoria') {
        return import('../../features/auditoria/pages/auditoria-page').then((m) => m.AuditPage);
      }
      return import('../../features/tablero/pages/espacio-trabajo-page').then((m) => m.WorkspacePage);
    },
    title: `${route.subcategory} - NexoDocs`,
    data: { routeInfo: route },
    canActivate: route.href.startsWith('/users') ? [authGuard, userAdminGuard] : [authGuard],
  }));

export const routes: Routes = [
  ...autenticacionRoutes,
  ...clinicoRoutes,
  ...administracionRoutes,
  ...documentosRoutes,
  ...expedientesRoutes,
  ...workflowsRoutes,
  ...dynamicCatalogRoutes,
  {
    path: '**',
    loadComponent: () => import('../../features/no-encontrado/pages/no-encontrado-page').then((m) => m.NotFoundPage),
    title: 'Pagina no encontrada - NexoDocs',
  },
];
