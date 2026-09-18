export type Role =
  | 'Usuario basico'
  | 'Supervisor'
  | 'Administrador de tenant'
  | 'Superadministrador';

export type NavChild = { label: string; href: string; visible?: boolean };
export type NavItem = { label: string; icon: string; children: NavChild[]; roles?: Role[] };
export type NavSection = { title: string; items: NavItem[] };
export type RouteInfo = { module: string; subcategory: string; href: string };
export type ScreenCopy = { description: string; action: string };
export type DemoItem = {
  title: string;
  meta: string;
  date: string;
  status: string;
  area?: string;
  createdAt?: string;
};

export type ClinicalEvent = {
  date: string;
  type: string;
  title: string;
  description: string;
  doctor: string;
  status: string;
};

export type Patient = {
  id: number;
  name: string;
  documentId: string;
  birthDate: string;
  gender: string;
  bloodType: string;
  phone: string;
  email: string;
  address: string;
  insuranceProvider: string;
  pdfFile: string;
  events: ClinicalEvent[];
};

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
          { label: 'Indicadores', href: '/dashboard/indicators' },
        ],
      },
      {
        label: 'Expedientes',
        icon: 'EX',
        children: [
          { label: 'Todos los expedientes', href: '/expedients' },
          { label: 'Crear expediente', href: '/expedients/new' },
          { label: 'Activos', href: '/expedients/active' },
          { label: 'Cerrados', href: '/expedients/closed' },
          { label: 'Archivados', href: '/expedients/archived' },
          { label: 'Expediente clínico', href: '/expedients/clinical' },
          { label: 'Notas médicas', href: '/expedients/clinical/notes' },
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
          { label: 'Compartidos conmigo', href: '/documents/shared' },
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
          { label: 'Activos', href: '/users/active' },
          { label: 'Bloqueados', href: '/users/blocked' },
          { label: 'Roles', href: '/users/roles' },
          { label: 'Permisos', href: '/users/permissions' },
          { label: 'Areas', href: '/users/areas' },
          { label: 'Grupos', href: '/users/groups' },
        ],
      },
      {
        label: 'Auditoria',
        icon: 'AU',
        roles: ['Administrador de tenant', 'Superadministrador'],
        children: [
          { label: 'Registro general', href: '/audit' },
          { label: 'Accesos', href: '/audit/access' },
          { label: 'Creacion de documentos', href: '/audit/document-creation' },
          { label: 'Modificaciones', href: '/audit/modifications' },
          { label: 'Descargas', href: '/audit/downloads' },
          { label: 'Aprobaciones', href: '/audit/approvals' },
          { label: 'Eliminaciones', href: '/audit/deletions' },
          { label: 'Cambios de permisos', href: '/audit/permissions' },
        ],
      },
      {
        label: 'Reportes',
        icon: 'RP',
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

export const documents: DemoItem[] = [
  { title: 'Politica de seguridad de la informacion', meta: 'DOC-2041 - PDF - Maria Gonzalez', date: 'Hoy, 09:42', status: 'Aprobado' },
  { title: 'Contrato marco proveedores 2025', meta: 'DOC-2042 - DOCX - Carlos Mendez', date: 'Ayer, 16:18', status: 'En revision' },
  { title: 'Informe auditoria interna Q2', meta: 'DOC-2043 - XLSX - Javier Ruiz', date: '10 jun 2025', status: 'Pendiente' },
  { title: 'Manual de incorporacion', meta: 'DOC-2044 - PDF - Ana Lopez', date: '08 jun 2025', status: 'Archivado' },
  { title: 'Borrador solicitud de compra', meta: 'DOC-2045 - DOCX - Ana Lopez', date: '03 jun 2025', status: 'Papelera' },
];

export const expedients: DemoItem[] = [
  { title: 'EXP-2041 - Alta de proveedor Andes', meta: 'Administrativo - Compras - 12 documentos', date: 'Actualizado hoy', status: 'Activo', area: 'Compras', createdAt: '2026-09-15' },
  { title: 'EXP-2038 - Renovacion contractual', meta: 'Contractual - Legal - 8 documentos', date: '12 jun 2026', status: 'Activo', area: 'Legal', createdAt: '2026-06-12' },
  { title: 'EXP-2027 - Implementacion ISO', meta: 'Calidad - Calidad - 15 documentos', date: '02 jun 2026', status: 'Activo', area: 'Calidad', createdAt: '2026-06-02' },
  { title: 'EXP-2014 - Auditoria interna Q2', meta: 'Auditoria - Calidad - 24 documentos', date: '31 may 2026', status: 'Cerrado', area: 'Calidad', createdAt: '2026-05-31' },
  { title: 'EXP-2009 - Contrato de servicios', meta: 'Contractual - Legal - 6 documentos', date: '18 may 2026', status: 'Cerrado', area: 'Legal', createdAt: '2026-05-18' },
  { title: 'EXP-1998 - Inventario sede norte', meta: 'Administrativo - Operaciones - 10 documentos', date: '04 may 2026', status: 'Archivado', area: 'Operaciones', createdAt: '2026-05-04' },
  { title: 'EXP-1982 - Proyecto sede norte', meta: 'Proyecto - Operaciones - 17 documentos', date: '18 abr 2026', status: 'Archivado', area: 'Operaciones', createdAt: '2026-04-18' },
  { title: 'EXP-1975 - Incidencia proveedor', meta: 'Administrativo - Compras - 4 documentos', date: '07 abr 2026', status: 'Bloqueado', area: 'Compras', createdAt: '2026-04-07' },
];

export const workflows: DemoItem[] = [
  { title: 'Aprobacion de contratos', meta: 'Contrato marco proveedores - Etapa 2 de 4', date: 'Vence manana', status: 'En revision' },
  { title: 'Alta de proveedor', meta: 'EXP-2041 - Responsable: Laura Martinez', date: 'Vence en 3 dias', status: 'Pendiente' },
  { title: 'Revision trimestral', meta: 'Informe auditoria interna Q2 - 4 etapas', date: 'Finalizado 10 jun', status: 'Completado' },
  { title: 'Publicacion de politicas', meta: 'Politica de seguridad - Etapa 3 de 3', date: 'Finalizado hoy', status: 'Completado' },
];

export const users: DemoItem[] = [
  { title: 'Laura Martinez', meta: 'laura@acme.com - Administradora - Direccion', date: 'Hace 4 min', status: 'Activo' },
  { title: 'Carlos Mendez', meta: 'carlos@acme.com - Supervisor - Legal', date: 'Hoy, 08:31', status: 'Activo' },
  { title: 'Ana Lopez', meta: 'ana@acme.com - Usuario operativo - Archivo', date: 'Ayer, 17:20', status: 'Activo' },
  { title: 'Javier Ruiz', meta: 'javier@acme.com - Auditor - Calidad', date: 'Bloqueado ayer', status: 'Bloqueado' },
];

export const tenants: DemoItem[] = [
  { title: 'Organización autenticada', meta: 'Tenant activo - usuarios del tenant', date: 'Almacenamiento consultado', status: 'Activo' },
  { title: 'Clinica Central', meta: 'clinica.nexodocs.app - Profesional - 86 usuarios', date: '14.2 GB de 25 GB', status: 'Activo' },
  { title: 'Universidad del Valle', meta: 'univalle.nexodocs.app - Empresarial - 124 usuarios', date: '31.6 GB de 50 GB', status: 'Activo' },
  { title: 'Grupo Norte', meta: 'gruponorte.nexodocs.app - Basico - 8 usuarios', date: '2.1 GB de 5 GB', status: 'Suspendido' },
];

export function screenCopy(route: RouteInfo): ScreenCopy {
  const action = route.subcategory.includes('Crear') || route.subcategory.includes('Nuevo')
    ? route.subcategory
    : route.subcategory.includes('Subir')
      ? 'Seleccionar archivo'
      : route.module === 'Reportes' || route.module === 'Auditoria'
        ? 'Exportar'
        : route.module === 'Configuracion'
          ? 'Guardar cambios'
          : 'Nueva accion';

  return {
    action,
    description: descriptions[`${route.module}|${route.subcategory}`] ??
      'Gestiona la operacion de tu organizacion desde este espacio.',
  };
}

export function demoList(module: string): DemoItem[] {
  if (module === 'Documentos' || module === 'Digitalizacion') return documents;
  if (module === 'Expedientes') return expedients;
  if (module === 'Workflows') return workflows;
  if (module === 'Usuarios y equipos') return users;
  if (module === 'Tenants') return tenants;
  if (module === 'Notificaciones') return workflows.slice(0, 3);
  return documents;
}

export function routeFor(module: string, subcategory?: string): string {
  const route = navigationRoutes.find(
    (item) => item.module === module && (!subcategory || item.subcategory === subcategory),
  );
  if (!route) throw new Error(`Ruta no definida: ${module} / ${subcategory}`);
  return route.href;
}

const descriptions: Record<string, string> = {
  'Inicio|Actividad reciente': 'Consulta los ultimos movimientos realizados dentro de la organizacion.',
  'Inicio|Mis tareas': 'Prioriza revisiones, aprobaciones y validaciones asignadas a tu usuario.',
  'Inicio|Indicadores': 'Analiza el rendimiento documental y operativo del tenant actual.',
  'Documentos|Todos los documentos': 'Repositorio central del tenant con trazabilidad, permisos y control de versiones.',
  'Documentos|Nuevo documento': 'Crea un documento desde cero o a partir de una plantilla institucional.',
  'Documentos|Subir archivo': 'Incorpora archivos y completa sus datos de clasificacion.',
  'Expedientes|Todos los expedientes': 'Consulta las unidades documentales y casos registrados en la organizacion.',
  'Expedientes|Crear expediente': 'Registra una unidad documental para agrupar documentos, participantes y procesos.',
  'Digitalizacion|Procesamiento OCR': 'Supervisa la extraccion de texto y el nivel de confianza de cada lote.',
  'Workflows|Disenador': 'Disena visualmente las etapas y decisiones de un flujo documental.',
  'Usuarios y equipos|Permisos': 'Controla que acciones puede realizar cada rol sobre los modulos del sistema.',
  'Auditoria|Registro general': 'Historico inmutable de acciones relevantes realizadas dentro del tenant.',
  'Reportes|Documentos': 'Distribucion documental por estado, tipo, area y periodo.',
  'Notificaciones|No leidas': 'Notificaciones nuevas que todavia requieren tu atencion.',
  'Configuracion|General': 'Datos institucionales y preferencias generales del tenant autenticado.',
  'Tenants|Todos los tenants': 'Administra las organizaciones aisladas registradas en la plataforma.',
  'Expedientes|Expediente clínico': 'Visualiza la historia clínica del paciente ordenada cronológicamente por fecha y evento.',
  'Expedientes|Notas médicas': 'Busca pacientes por documento de identidad o nombre y registra notas de evolución.',
};

export const patients: Patient[] = ﻿[
  {
    "id": 1,
    "name": "Silvia Ortiz Gonzales",
    "documentId": "HC-2026-1001",
    "birthDate": "1964-03-03",
    "gender": "Femenino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cobija",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-1.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Enalapril 10mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 2,
    "name": "╔dgar Condori Rivero",
    "documentId": "HC-2026-1010",
    "birthDate": "1983-06-24",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Riberalta",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-10.pdf",
    "events": [
      {
        "date": "2017-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Levotiroxina 100mcg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 3,
    "name": "Luis Ortiz Gonzales",
    "documentId": "HC-2026-1011",
    "birthDate": "1990-02-07",
    "gender": "Masculino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Santa Cruz de la Sierra",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-11.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "Apendicitis (2021)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Apendicitis (2021).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Levotiroxina 100mcg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 4,
    "name": "Tito Sußrez Apaza",
    "documentId": "HC-2026-1012",
    "birthDate": "1969-11-25",
    "gender": "Masculino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "El Alto",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-12.pdf",
    "events": [
      {
        "date": "2016-01-15",
        "type": "CirugÝa",
        "title": "Apendicitis (2021)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Apendicitis (2021).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Losartßn 50mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 5,
    "name": "Hugo Paz Gonzales",
    "documentId": "HC-2026-1013",
    "birthDate": "1966-05-02",
    "gender": "Masculino",
    "bloodType": "O+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Yacuiba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-13.pdf",
    "events": [
      {
        "date": "2020-01-15",
        "type": "CirugÝa",
        "title": "Apendicitis (2021)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Apendicitis (2021).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Metformina 850mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 6,
    "name": "Beatriz Mendoza Rivero",
    "documentId": "HC-2026-1014",
    "birthDate": "1993-08-18",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Yacuiba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-14.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "Parto (2020)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Parto (2020).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Metformina 850mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 7,
    "name": "Yesenia Aguilar Choque",
    "documentId": "HC-2026-1015",
    "birthDate": "1977-11-12",
    "gender": "Masculino",
    "bloodType": "AB+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cobija",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-15.pdf",
    "events": [
      {
        "date": "2015-01-15",
        "type": "CirugÝa",
        "title": "Ninguna",
        "description": "Hospitalizaci¾n registrada en antecedentes. Ninguna.",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Losartßn 50mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 8,
    "name": "Ramiro Ortiz Rojas",
    "documentId": "HC-2026-1016",
    "birthDate": "1978-06-10",
    "gender": "Masculino",
    "bloodType": "AB+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cochabamba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-16.pdf",
    "events": [
      {
        "date": "2018-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Salbutamol inhalador",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 9,
    "name": "Norma Quispe Quispe",
    "documentId": "HC-2026-1017",
    "birthDate": "1968-03-07",
    "gender": "Femenino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "La Paz",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-17.pdf",
    "events": [
      {
        "date": "2022-01-15",
        "type": "CirugÝa",
        "title": "NeumonÝa (2022)",
        "description": "Hospitalizaci¾n registrada en antecedentes. NeumonÝa (2022).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      }
    ]
  },
  {
    "id": 10,
    "name": "Rosa Antelo Salazar",
    "documentId": "HC-2026-1018",
    "birthDate": "1983-04-18",
    "gender": "Masculino",
    "bloodType": "AB+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "El Alto",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-18.pdf",
    "events": [
      {
        "date": "2021-01-15",
        "type": "CirugÝa",
        "title": "Ninguna",
        "description": "Hospitalizaci¾n registrada en antecedentes. Ninguna.",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Enalapril 10mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 11,
    "name": "Cecilia Ortiz Guzmßn",
    "documentId": "HC-2026-1019",
    "birthDate": "2000-08-24",
    "gender": "Masculino",
    "bloodType": "O+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Riberalta",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-19.pdf",
    "events": [
      {
        "date": "2019-01-15",
        "type": "CirugÝa",
        "title": "Apendicitis (2021)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Apendicitis (2021).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Levotiroxina 100mcg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 12,
    "name": "Patricia Choque Vaca",
    "documentId": "HC-2026-1002",
    "birthDate": "2000-07-06",
    "gender": "Masculino",
    "bloodType": "A-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Oruro",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-2.pdf",
    "events": [
      {
        "date": "2017-01-15",
        "type": "CirugÝa",
        "title": "Ninguna",
        "description": "Hospitalizaci¾n registrada en antecedentes. Ninguna.",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Salbutamol inhalador",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 13,
    "name": "Marisol Peredo Peredo",
    "documentId": "HC-2026-1020",
    "birthDate": "1966-08-11",
    "gender": "Masculino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Trinidad",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-20.pdf",
    "events": [
      {
        "date": "2018-01-15",
        "type": "CirugÝa",
        "title": "NeumonÝa (2022)",
        "description": "Hospitalizaci¾n registrada en antecedentes. NeumonÝa (2022).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Metformina 850mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 14,
    "name": "Oscar Cßrdenas Choque",
    "documentId": "HC-2026-1003",
    "birthDate": "1964-02-04",
    "gender": "Femenino",
    "bloodType": "O-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Oruro",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-3.pdf",
    "events": [
      {
        "date": "2016-01-15",
        "type": "CirugÝa",
        "title": "Fractura de brazo (2019)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Fractura de brazo (2019).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de ┴cido valproico 500mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 15,
    "name": "Wilson Peredo Ibß±ez",
    "documentId": "HC-2026-1004",
    "birthDate": "2000-02-26",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Villaz¾n",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-4.pdf",
    "events": [
      {
        "date": "2018-01-15",
        "type": "CirugÝa",
        "title": "Parto (2020)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Parto (2020).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Enalapril 10mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 16,
    "name": "Ricardo Rojas Ibß±ez",
    "documentId": "HC-2026-1005",
    "birthDate": "1988-09-22",
    "gender": "Masculino",
    "bloodType": "B+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Riberalta",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-5.pdf",
    "events": [
      {
        "date": "2016-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de ┴cido valproico 500mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 17,
    "name": "Gabriel Flores Ibß±ez",
    "documentId": "HC-2026-1006",
    "birthDate": "1983-12-02",
    "gender": "Femenino",
    "bloodType": "O-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cochabamba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-6.pdf",
    "events": [
      {
        "date": "2019-01-15",
        "type": "CirugÝa",
        "title": "Fractura de brazo (2019)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Fractura de brazo (2019).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Salbutamol inhalador",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 18,
    "name": "Oscar Condori Gonzales",
    "documentId": "HC-2026-1007",
    "birthDate": "1978-11-12",
    "gender": "Femenino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "La Paz",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-7.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      }
    ]
  },
  {
    "id": 19,
    "name": "Norma Peredo Apaza",
    "documentId": "HC-2026-1008",
    "birthDate": "1971-07-25",
    "gender": "Masculino",
    "bloodType": "O+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cobija",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-8.pdf",
    "events": [
      {
        "date": "2016-01-15",
        "type": "CirugÝa",
        "title": "Ninguna",
        "description": "Hospitalizaci¾n registrada en antecedentes. Ninguna.",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Levotiroxina 100mcg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 20,
    "name": "Rosario Cßrdenas Paz",
    "documentId": "HC-2026-1009",
    "birthDate": "1985-03-08",
    "gender": "Masculino",
    "bloodType": "B+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Camiri",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-9.pdf",
    "events": [
      {
        "date": "2025-01-15",
        "type": "CirugÝa",
        "title": "NeumonÝa (2022)",
        "description": "Hospitalizaci¾n registrada en antecedentes. NeumonÝa (2022).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Salbutamol inhalador",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  }
];
