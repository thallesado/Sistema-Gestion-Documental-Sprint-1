import { Routes } from '@angular/router';
import { LoginPage } from '../../features/auth/login-page';
import { navigationRoutes } from '../data/nexodocs-data';
import { NotFoundPage } from '../../features/not-found/not-found-page';
import { WorkspacePage } from '../../features/workspace/workspace-page';
import { ReportsPage } from '../../features/reports/reports-page';
import { AuditPage } from '../../features/audit/audit-page';
import { authGuard } from '../auth/auth.guard';
import { ClinicalPage } from '../../features/clinical/clinical-page';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    title: 'Login - NexoDocs',
  },
  {
    path: 'expedients/clinical',
    component: ClinicalPage,
    title: 'Expediente clínico - NexoDocs',
    data: { routeInfo: { module: 'Expedientes', subcategory: 'Expediente clínico', href: '/expedients/clinical' }, mode: 'records' },
    canActivate: [authGuard],
  },
  {
    path: 'expedients/clinical/notes',
    component: ClinicalPage,
    title: 'Notas médicas - NexoDocs',
    data: { routeInfo: { module: 'Expedientes', subcategory: 'Notas médicas', href: '/expedients/clinical/notes' }, mode: 'notes' },
    canActivate: [authGuard],
  },
  ...navigationRoutes
    .filter((route) => !clinicalPaths.has(route.href.slice(1)))
    .map((route) => ({
      path: route.href === '/' ? '' : route.href.slice(1),
      component: route.module === 'Reportes'
        ? ReportsPage
        : route.module === 'Auditoria'
          ? AuditPage
          : WorkspacePage,
      title: `${route.subcategory} - NexoDocs`,
      data: { routeInfo: route },
      canActivate: [authGuard],
    })),
  {
    path: '**',
    component: NotFoundPage,
    title: 'Pagina no encontrada - NexoDocs',
  },
];
