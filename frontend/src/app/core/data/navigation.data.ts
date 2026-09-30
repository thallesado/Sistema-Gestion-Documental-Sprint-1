import type { NavChild, NavItem, NavSection, Role, RouteInfo } from './data.types';

export const roles: Role[] = [
  'Usuario basico',
  'Supervisor',
  'Administrador de tenant',
  'Superadministrador',
];

export const navSections: NavSection[] = [
  {
    title: 'Espacio de trabajo',
    items: [
      {
        label: 'Inicio',
        icon: 'IN',
        children: [
          { label: 'Resumen', href: '/' },
          { label: 'Actividad reciente', href: '/dashboard/activity' },
          { label: 'Mis tareas', href: '/dashboard/tasks' },
          { label: 'Indicadores', href: '/dashboard/indicators', sprintEnabled: false },
        ],
      },
      {
        label: 'Expedientes',
        icon: 'EX',
        children: [
          { label: 'Todos los expedientes', href: '/expedients' },
          { label: 'Crear expediente', href: '/expedients/new' },
          { label: 'Activos', href: '/expedients/active', sprintEnabled: false },
          { label: 'Cerrados', href: '/expedients/closed', sprintEnabled: false },
          { label: 'Archivados', href: '/expedients/archived', sprintEnabled: false },
          { label: 'Expediente clínico', href: '/expedients/clinical' },
          { label: 'Notas médicas', href: '/expedients/clinical/notes' },
        ],
      },
      {
        label: 'Módulo Clínico',
        icon: 'MC',
        children: [
          { label: 'Pacientes', href: '/clinical/patients' },
          { label: 'Antecedentes', href: '/clinical/history' },
        ],
      },
      {
        label: 'Documentos',
        icon: 'DO',
        children: [
          { label: 'Todos los documentos', href: '/documents' },
          { label: 'Nuevo documento', href: '/documents/new' },
          { label: 'Subir archivo', href: '/documents/upload' },
          { label: 'Mis documentos', href: '/documents/mine' },
          { label: 'Compartidos conmigo', href: '/documents/shared', sprintEnabled: false },
          { label: 'Recientes', href: '/documents/recent', visible: false },
          { label: 'Pendientes', href: '/documents/pending', visible: false },
          { label: 'En revision', href: '/documents/in-review', visible: false },
          { label: 'Aprobados', href: '/documents/approved', visible: false },
          { label: 'Archivados', href: '/documents/archived', visible: false },
          { label: 'Papelera', href: '/documents/trash', visible: false },
        ],
      },
      {
        label: 'Digitalizacion',
        icon: 'DG',
        roles: ['Administrador de tenant', 'Superadministrador'],
        sprintEnabled: false,
        children: [
          { label: 'Escanear documento', href: '/digitization' },
          { label: 'Subir documento', href: '/digitization/upload', visible: false },
          { label: 'Procesamiento OCR', href: '/digitization/ocr' },
          { label: 'Validacion', href: '/digitization/validation', visible: false },
          { label: 'Indexacion', href: '/digitization/indexing', visible: false },
          { label: 'Correccion de metadatos', href: '/digitization/metadata', visible: false },
        ],
      },
    ],
  },
  {
    title: 'Procesos',
    items: [
      {
        label: 'Workflows',
        icon: 'WF',
        sprintEnabled: false,
        children: [
          { label: 'Todos los workflows', href: '/workflows' },
          { label: 'Mis tareas', href: '/workflows/tasks' },
          { label: 'Pendientes de revision', href: '/workflows/pending-review' },
          { label: 'Pendientes de aprobacion', href: '/workflows/pending-approval' },
          { label: 'Activos', href: '/workflows/active' },
          { label: 'Finalizados', href: '/workflows/completed' },
          { label: 'Plantillas', href: '/workflows/templates' },
          { label: 'Disenador', href: '/workflows/designer' },
        ],
      },
    ],
  },
  {
    title: 'Gestion',
    items: [
      {
        label: 'Usuarios y equipos',
        icon: 'US',
        roles: ['Administrador de tenant', 'Superadministrador'],
        children: [
          { label: 'Todos los usuarios', href: '/users' },
          { label: 'Crear usuario', href: '/users/new' },
          { label: 'Activos', href: '/users/active', sprintEnabled: false },
          { label: 'Bloqueados', href: '/users/blocked', sprintEnabled: false },
          { label: 'Roles', href: '/users/roles' },
          { label: 'Permisos', href: '/users/permissions' },
          { label: 'Areas', href: '/users/areas', sprintEnabled: false },
          { label: 'Grupos', href: '/users/groups', sprintEnabled: false },
        ],
      },
      {
        label: 'Auditoria',
        icon: 'AU',
        roles: ['Administrador de tenant', 'Superadministrador'],
        children: [
          { label: 'Registro general', href: '/audit' },
          { label: 'Accesos', href: '/audit/access' },
          { label: 'Creacion de documentos', href: '/audit/document-creation', sprintEnabled: false },
          { label: 'Modificaciones', href: '/audit/modifications', sprintEnabled: false },
          { label: 'Descargas', href: '/audit/downloads', sprintEnabled: false },
          { label: 'Aprobaciones', href: '/audit/approvals', sprintEnabled: false },
          { label: 'Eliminaciones', href: '/audit/deletions', sprintEnabled: false },
          { label: 'Cambios de permisos', href: '/audit/permissions', sprintEnabled: false },
        ],
      },
      {
        label: 'Reportes',
        icon: 'RP',
        sprintEnabled: false,
        children: [
          { label: 'Documentos', href: '/reports' },
          { label: 'Usuarios', href: '/reports/users' },
          { label: 'Workflows', href: '/reports/workflows' },
          { label: 'Almacenamiento', href: '/reports/storage' },
          { label: 'Auditoría', href: '/reports/audit' },
          { label: 'Productividad', href: '/reports/productivity' },
          { label: 'Actividad por área', href: '/reports/by-area' },
        ],
      },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        label: 'Notificaciones',
        icon: 'NT',
        sprintEnabled: false,
        children: [
          { label: 'Todas', href: '/notifications' },
          { label: 'No leidas', href: '/notifications/unread' },
          { label: 'Tareas', href: '/notifications/tasks' },
          { label: 'Aprobaciones', href: '/notifications/approvals' },
          { label: 'Menciones', href: '/notifications/mentions' },
        ],
      },
      {
        label: 'Configuracion',
        icon: 'CF',
        roles: ['Administrador de tenant', 'Superadministrador'],
        sprintEnabled: false,
        children: [
          { label: 'General', href: '/settings' },
          { label: 'Tipos documentales', href: '/settings/document-types' },
          { label: 'Estados', href: '/settings/statuses' },
          { label: 'Metadatos', href: '/settings/metadata' },
          { label: 'Etiquetas', href: '/settings/tags' },
          { label: 'Plantillas', href: '/settings/templates' },
          { label: 'Retencion', href: '/settings/retention' },
          { label: 'Seguridad', href: '/settings/security' },
          { label: 'Apariencia', href: '/settings/appearance' },
        ],
      },
    ],
  },
  {
    title: 'Administracion global',
    items: [
      {
        label: 'Tenants',
        icon: 'TN',
        roles: ['Superadministrador'],
        sprintEnabled: false,
        children: [
          { label: 'Todos los tenants', href: '/tenants' },
          { label: 'Crear tenant', href: '/tenants/new' },
          { label: 'Activos', href: '/tenants/active' },
          { label: 'Suspendidos', href: '/tenants/suspended' },
          { label: 'Planes', href: '/tenants/plans' },
          { label: 'Uso de almacenamiento', href: '/tenants/storage' },
          { label: 'Branding', href: '/tenants/branding' },
        ],
      },
    ],
  },
];

export const navigationRoutes: RouteInfo[] = navSections.flatMap((section) =>
  section.items.flatMap((item) =>
    item.children.map((child) => ({
      module: item.label,
      subcategory: child.label,
      href: child.href,
    })),
  ),
);

export function routeFor(module: string, subcategory?: string): string {
  const route = navigationRoutes.find(
    (item) => item.module === module && (!subcategory || item.subcategory === subcategory),
  );
  if (!route) throw new Error(`Ruta no definida: ${module} / ${subcategory}`);
  return route.href;
}
