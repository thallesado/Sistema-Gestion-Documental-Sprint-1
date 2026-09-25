import { Routes } from '@angular/router';
import { navigationRoutes } from '../data/nexodocs-data';
import { authGuard } from '../auth/auth.guard';
import { autenticacionRoutes } from '../../modulos/autenticacion/autenticacion.routes';
import { clinicoRoutes } from '../../modulos/clinico/clinico.routes';
import { administracionRoutes } from '../../modulos/administracion/administracion.routes';
import { documentosRoutes } from '../../modulos/documentos/documentos.routes';
import { expedientesRoutes } from '../../modulos/expedientes/expedientes.routes';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);
const documentPaths = new Set(['documents', 'documents/mine', 'documents/shared', 'documents/new', 'documents/upload', 'settings/statuses']);
const expedientPaths = new Set(['expedients', 'expedients/new', 'expedients/active', 'expedients/closed', 'expedients/archived']);

const dynamicCatalogRoutes: Routes = navigationRoutes
  .filter((route) => !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
  .map((route) => ({
    path: route.href === '/' ? '' : route.href.slice(1),
    loadComponent: () => {
      if (route.module === 'Reportes') {
        return import('../../modulos/reportes/reportes-page').then((m) => m.ReportsPage);
      }
      if (route.module === 'Auditoria') {
        return import('../../modulos/auditoria/auditoria-page').then((m) => m.AuditPage);
      }
      return import('../../modulos/espacio-trabajo/espacio-trabajo-page').then((m) => m.WorkspacePage);
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
    loadComponent: () => import('../../modulos/no-encontrado/no-encontrado-page').then((m) => m.NotFoundPage),
    title: 'Pagina no encontrada - NexoDocs',
  },
];
