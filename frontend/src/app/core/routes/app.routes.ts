import { Routes } from '@angular/router';
import { navigationRoutes, RouteInfo } from '../data/nexodocs-data';
import { authGuard, rootEntryGuard, userAdminGuard } from '../auth/auth.guard';
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
// WorkspacePage is shared by the dashboard and catalogue routes.  It reads
// routeInfo during its first change-detection cycle, so the root dashboard
// must provide the same metadata as the remaining workspace routes.
const homeRoute: RouteInfo = navigationRoutes.find((route) => route.href === '/') ?? {
  module: 'Inicio',
  subcategory: 'Resumen',
  href: '/',
};

const dynamicCatalogRoutes: Routes = navigationRoutes
  .filter((route) => route.href !== '/' && route.module !== 'Workflows' && !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
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
  {
    path: '', pathMatch: 'full',
    loadComponent: () => import('../../features/tablero/pages/espacio-trabajo-page').then((m) => m.WorkspacePage),
    title: 'NexoDocs',
    data: { routeInfo: homeRoute },
    canActivate: [rootEntryGuard],
  },
  ...clinicoRoutes,
  ...administracionRoutes,
  ...documentosRoutes,
  ...expedientesRoutes,
  ...workflowsRoutes,
  {
    path: 'billing',
    loadComponent: () => import('../../features/billing/pages/billing-page').then((m) => m.BillingPage),
    title: 'Facturación e ingresos - NexoDocs', canActivate: [authGuard],
  },
  {
    path: 'plans/contact-sales',
    loadComponent: () => import('../../features/subscription/pages/contact-sales-page').then((m) => m.ContactSalesPage),
    title: 'NexoDocs Enterprise',
  },
  ...dynamicCatalogRoutes,
  {
    path: '**',
    loadComponent: () => import('../../features/no-encontrado/pages/no-encontrado-page').then((m) => m.NotFoundPage),
    title: 'Pagina no encontrada - NexoDocs',
  },
];
