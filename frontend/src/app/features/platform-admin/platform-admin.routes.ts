import { Routes } from '@angular/router';
import { authGuard, platformAdminGuard } from '../../core/auth/auth.guard';
import { RouteInfo } from '../../core/data/nexodocs-data';

const tenantsReport: RouteInfo = { module: 'Reportes', subcategory: 'Reporte de tenants', href: '/platform/reports/tenants' };
const paymentsReport: RouteInfo = { module: 'Reportes', subcategory: 'Reporte de pagos y costos', href: '/platform/reports/payments' };

/** Platform administrator area: global dashboard and cross-tenant reports (backend: platform:tenant:manage). */
export const platformAdminRoutes: Routes = [
  {
    path: 'platform/dashboard',
    loadComponent: () => import('./pages/platform-dashboard-page').then((m) => m.PlatformDashboardPage),
    title: 'Panel de plataforma - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
  {
    path: 'platform/reports/tenants',
    loadComponent: () => import('../reportes/pages/reportes-page').then((m) => m.ReportsPage),
    title: 'Reporte de tenants - NexoDocs',
    data: { routeInfo: tenantsReport },
    canActivate: [authGuard, platformAdminGuard],
  },
  {
    path: 'platform/reports/payments',
    loadComponent: () => import('../reportes/pages/reportes-page').then((m) => m.ReportsPage),
    title: 'Reporte de pagos y costos - NexoDocs',
    data: { routeInfo: paymentsReport },
    canActivate: [authGuard, platformAdminGuard],
  },
];
