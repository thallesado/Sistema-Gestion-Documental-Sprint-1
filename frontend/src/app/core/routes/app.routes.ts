import { Routes } from '@angular/router';
import { LoginPage } from '../../features/auth/login-page';
import { navigationRoutes } from '../data/nexodocs-data';
import { NotFoundPage } from '../../features/not-found/not-found-page';
import { WorkspacePage } from '../../features/workspace/workspace-page';
import { ReportsPage } from '../../features/reports/reports-page';
import { AuditPage } from '../../features/audit/audit-page';
import { authGuard } from '../auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    title: 'Login - NexoDocs',
  },
  ...navigationRoutes.map((route) => ({
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
