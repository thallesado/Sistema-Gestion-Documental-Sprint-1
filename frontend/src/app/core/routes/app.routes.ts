import { Routes } from '@angular/router';
import { navigationRoutes } from '../data/nexodocs-data';
import { authGuard, platformAdminGuard, publicGuard, userAdminGuard } from '../auth/auth.guard';
import { MainLayoutComponent } from '../../layout/main-layout/main-layout.component';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);
const documentPaths = new Set(['documents', 'documents/mine', 'documents/shared', 'documents/new', 'documents/upload', 'settings/statuses']);
const expedientPaths = new Set(['expedientes', 'expedients', 'expedientes/new', 'expedientes/active', 'expedients/closed', 'expedients/archived']);

const expedientViews: [string, string, string][] = [
  ['expedients', 'all', 'Todos los expedientes'],
  ['expedientes', 'all', 'Todos los expedientes'],
  ['expedients/new', 'new', 'Crear expediente'],
  ['expedientes/new', 'new', 'Crear expediente'],
  ['expedients/active', 'active', 'Activos'],
  ['expedientes/active', 'active', 'Activos'],
  ['expedients/closed', 'closed', 'Cerrados'],
  ['expedientes/closed', 'closed', 'Cerrados'],
  ['expedients/archived', 'archived', 'Archivados'],
  ['expedientes/archived', 'archived', 'Archivados'],
];

const dynamicCatalogRoutes: Routes = navigationRoutes
  .filter((route) => !clinicalPaths.has(route.href.slice(1)) && !documentPaths.has(route.href.slice(1)) && !expedientPaths.has(route.href.slice(1)))
  .map((route) => ({
    path: route.href === '/' ? '' : route.href.slice(1),
    loadComponent: () => {
      if (route.module === 'Reportes') {
        return import('../../pages/reportes/reportes.page').then((m) => m.ReportesPage);
      }
      if (route.module === 'Auditoria') {
        return import('../../pages/auditoria/auditoria.page').then((m) => m.AuditoriaPage);
      }
      if (route.module === 'Módulo Clínico' && route.subcategory === 'Antecedentes') {
        return import('../../pages/clinico/antecedentes/antecedentes.page').then((m) => m.AntecedentesPage);
      }
      return import('../../pages/tablero/espacio-trabajo/espacio-trabajo.page').then((m) => m.EspacioTrabajoPage);
    },
    title: `${route.subcategory} - NexoDocs`,
    data: { routeInfo: route },
    canActivate: route.href.startsWith('/users') ? [userAdminGuard] : [],
  }));

export const routes: Routes = [
  // Rutas públicas de autenticación
  {
    path: 'login',
    loadComponent: () => import('../../pages/auth/login/login.page').then((m) => m.LoginPage),
    title: 'Iniciar sesión - NexoDocs',
    canActivate: [publicGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('../../pages/auth/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña - NexoDocs',
    canActivate: [publicGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () => import('../../pages/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('../../pages/auth/reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },

  // Rutas autenticadas contenidas dentro del Layout principal
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('../../pages/tablero/espacio-trabajo/espacio-trabajo.page').then((m) => m.EspacioTrabajoPage),
        title: 'Espacio de trabajo - NexoDocs',
      },
      // Documentos
      {
        path: 'documents',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Documentos - NexoDocs',
      },
      {
        path: 'documents/mine',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Mis documentos - NexoDocs',
      },
      {
        path: 'documents/shared',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Compartidos conmigo - NexoDocs',
      },
      {
        path: 'documents/new',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Nuevo documento - NexoDocs',
      },
      {
        path: 'documents/upload',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Subir archivo - NexoDocs',
      },
      {
        path: 'settings/statuses',
        loadComponent: () => import('../../pages/documentos/documentos.page').then((m) => m.DocumentosPage),
        title: 'Estados documentales - NexoDocs',
      },

      // Expedientes
      ...expedientViews.map(([path, expedientView, title]) => ({
        path,
        loadComponent: () => import('../../pages/expedientes/expedientes.page').then((m) => m.ExpedientsPage),
        title: `${title} - NexoDocs`,
        data: { expedientView },
      })),

      // Módulo Clínico
      {
        path: 'expedients/clinical',
        loadComponent: () => import('../../pages/clinico/expediente-clinico/expediente-clinico.page').then((m) => m.ExpedienteClinicoPage),
        title: 'Expediente clínico - NexoDocs',
        data: {
          routeInfo: { module: 'Expedientes', subcategory: 'Expediente clínico', href: '/expedients/clinical' },
          mode: 'records',
        },
      },
      {
        path: 'expedients/clinical/notes',
        loadComponent: () => import('../../pages/clinico/expediente-clinico/expediente-clinico.page').then((m) => m.ExpedienteClinicoPage),
        title: 'Notas médicas - NexoDocs',
        data: {
          routeInfo: { module: 'Expedientes', subcategory: 'Notas médicas', href: '/expedients/clinical/notes' },
          mode: 'notes',
        },
      },
      {
        path: 'expedients/clinical/antecedentes',
        loadComponent: () => import('../../pages/clinico/antecedentes/antecedentes.page').then((m) => m.AntecedentesPage),
        title: 'Captura de antecedentes - NexoDocs',
      },

      // Administración de usuarios y tenants
      {
        path: 'users',
        loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
        title: 'Usuarios del tenant - NexoDocs',
        canActivate: [userAdminGuard],
      },
      {
        path: 'tenants',
        loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
        title: 'Tenants - NexoDocs',
        canActivate: [platformAdminGuard],
      },
      {
        path: 'tenants/new',
        loadComponent: () => import('../../pages/users/administracion/administracion.page').then((m) => m.AdministracionPage),
        title: 'Crear tenant - NexoDocs',
        canActivate: [platformAdminGuard],
      },

      // Auditoría
      {
        path: 'audit',
        loadComponent: () => import('../../pages/auditoria/auditoria.page').then((m) => m.AuditoriaPage),
        title: 'Auditoría - NexoDocs',
      },
      {
        path: 'audit/access',
        loadComponent: () => import('../../pages/auditoria/auditoria.page').then((m) => m.AuditoriaPage),
        title: 'Control de accesos - NexoDocs',
      },

      // Reportes
      {
        path: 'reports',
        loadComponent: () => import('../../pages/reportes/reportes.page').then((m) => m.ReportesPage),
        title: 'Reportes - NexoDocs',
      },

      // Rutas dinámicas del catálogo
      ...dynamicCatalogRoutes,

      // Acceso denegado
      {
        path: 'access-denied',
        loadComponent: () => import('../../pages/no-encontrado/access-denied/access-denied.page').then((m) => m.AccessDeniedPage),
        title: 'Acceso restringido - NexoDocs',
      },

      // 404 dentro del layout
      {
        path: '**',
        loadComponent: () => import('../../pages/no-encontrado/no-encontrado/no-encontrado.page').then((m) => m.NotFoundPage),
        title: 'Página no encontrada - NexoDocs',
      },
    ],
  },
];
