import { Routes } from '@angular/router';
import { authGuard, platformAdminGuard } from '../../core/auth/auth.guard';
import { RouteInfo } from '../../core/data/nexodocs-data';

const tenantsReport: RouteInfo = { module: 'Reportes', subcategory: 'Reporte de tenants', href: '/platform/reports/tenants' };
const paymentsReport: RouteInfo = { module: 'Reportes', subcategory: 'Reporte de pagos y costos', href: '/platform/reports/payments' };

/** Platform administrator area: global dashboard and cross-tenant reports (backend: platform:tenant:manage). */
export const platformAdminRoutes: Routes = [
  {
    path: 'platform/tenants/:id',
    loadComponent: () => import('./pages/platform-tenant-page').then((m) => m.PlatformTenantPage),
    title: 'Ficha de organización - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
  {
    path: 'platform/plans',
    loadComponent: () => import('./pages/platform-plans-page').then((m) => m.PlatformPlansPage),
    title: 'Planes y precios - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
  {
    path: 'platform/addons',
    loadComponent: () => import('./pages/platform-addons-page').then((m) => m.PlatformAddonsPage),
    title: 'Complementos - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
  {
    path: 'platform/audit',
    loadComponent: () => import('./pages/platform-audit-page').then((m) => m.PlatformAuditPage),
    title: 'Auditoría de plataforma - NexoDocs',
    canActivate: [authGuard, platformAdminGuard],
  },
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
