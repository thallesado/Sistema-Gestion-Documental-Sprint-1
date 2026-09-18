import { Routes } from '@angular/router';
import { LoginPage } from '../../features/auth/login-page';
import { navigationRoutes } from '../data/nexodocs-data';
import { NotFoundPage } from '../../features/not-found/not-found-page';
import { WorkspacePage } from '../../features/workspace/workspace-page';
import { ReportsPage } from '../../features/reports/reports-page';
import { AuditPage } from '../../features/audit/audit-page';
import { authGuard } from '../auth/auth.guard';
import { ClinicalPage } from '../../features/clinical/clinical-page';
import { ForgotPasswordPage } from '../../features/auth/forgot-password-page';
import { ResetPasswordPage } from '../../features/auth/reset-password-page';
import { AdministrationPage } from '../../features/administration/administration-page';
import { DocumentPage } from '../../features/documents/document-page';
import { ExpedientsPage } from '../../features/expedients/expedients-page';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);
const documentPaths = new Set(['documents', 'settings/statuses']);
const expedientPaths = new Set(['expedients', 'expedients/new', 'expedients/active', 'expedients/closed', 'expedients/archived']);

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    title: 'Login - NexoDocs',
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordPage,
    title: 'Recuperar contraseña - NexoDocs',
  },
  {
    path: 'reset-password',
    component: ResetPasswordPage,
    title: 'Restablecer contraseña - NexoDocs',
  },
  {
    path: 'reset-password/:token',
    component: ResetPasswordPage,
    title: 'Restablecer contraseña - NexoDocs',
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
  {
    path: 'users',
    component: AdministrationPage,
    title: 'Usuarios del tenant - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'users/new',
    component: AdministrationPage,
    title: 'Crear usuario - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'tenants',
    component: AdministrationPage,
    title: 'Tenants - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'tenants/new',
    component: AdministrationPage,
    title: 'Crear tenant - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'documents',
    component: DocumentPage,
    title: 'Documentos - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'settings/statuses',
    component: DocumentPage,
    title: 'Estados documentales - NexoDocs',
    canActivate: [authGuard],
  },
  ...[
    ['expedients', 'all', 'Todos los expedientes'],
    ['expedients/new', 'new', 'Crear expediente'],
    ['expedients/active', 'active', 'Activos'],
    ['expedients/closed', 'closed', 'Cerrados'],
    ['expedients/archived', 'archived', 'Archivados'],
  ].map(([path, expedientView, title]) => ({
    path,
    component: ExpedientsPage,
    title: `${title} - NexoDocs`,
    data: { expedientView },
    canActivate: [authGuard],
  })),
  ...navigationRoutes
    .filter((route) => !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
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
