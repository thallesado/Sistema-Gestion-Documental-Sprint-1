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
          // { label: 'Actividad reciente', href: '/dashboard/activity' },
          // { label: 'Mis tareas', href: '/dashboard/tasks' },
          // { label: 'Indicadores', href: '/dashboard/indicators' },
        ],
      },
      {
        label: 'Expedientes',
        icon: 'EX',
        children: [
          { label: 'Todos los expedientes', href: '/expedients' },
          { label: 'Crear expediente', href: '/expedients/new' },
          // { label: 'Activos', href: '/expedients/active' },
          // { label: 'Cerrados', href: '/expedients/closed' },
          // { label: 'Archivados', href: '/expedients/archived' },
          { label: 'Expediente clínico', href: '/expedients/clinical' },
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
      // {
      //   label: 'Digitalizacion',
      //   icon: 'DG',
      //   roles: ['Administrador de tenant', 'Superadministrador'],
      //   children: [
      //     { label: 'Escanear documento', href: '/digitization' },
      //     { label: 'Subir documento', href: '/digitization/upload', visible: false },
      //     { label: 'Procesamiento OCR', href: '/digitization/ocr' },
      //     { label: 'Validacion', href: '/digitization/validation', visible: false },
      //     { label: 'Indexacion', href: '/digitization/indexing', visible: false },
      //     { label: 'Correccion de metadatos', href: '/digitization/metadata', visible: false },
      //   ],
      // },
    ],
  },
  /*
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
          { label: 'Auditoria', href: '/reports/audit' },
          { label: 'Productividad', href: '/reports/productivity' },
          { label: 'Actividad por area', href: '/reports/by-area' },
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
  */
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

export const documents: DemoItem[] = [];

export const expedients: DemoItem[] = [];

export const workflows: DemoItem[] = [];

export const users: DemoItem[] = [];

export const tenants: DemoItem[] = [];

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
  'Configuracion|General': 'Datos institucionales y preferencias generales de Acme Consulting.',
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
        "type": "Cirugía",
        "title": "Colecistectomía (2023)",
        "description": "Hospitalización registrada en antecedentes. Colecistectomía (2023).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Enalapril 10mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 2,
    "name": "Édgar Condori Rivero",
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
        "type": "Cirugía",
        "title": "Colecistectomía (2023)",
        "description": "Hospitalización registrada en antecedentes. Colecistectomía (2023).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Levotiroxina 100mcg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Apendicitis (2021)",
        "description": "Hospitalización registrada en antecedentes. Apendicitis (2021).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Levotiroxina 100mcg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 4,
    "name": "Tito Suárez Apaza",
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
        "type": "Cirugía",
        "title": "Apendicitis (2021)",
        "description": "Hospitalización registrada en antecedentes. Apendicitis (2021).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Losartán 50mg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Apendicitis (2021)",
        "description": "Hospitalización registrada en antecedentes. Apendicitis (2021).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Metformina 850mg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Parto (2020)",
        "description": "Hospitalización registrada en antecedentes. Parto (2020).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Metformina 850mg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Ninguna",
        "description": "Hospitalización registrada en antecedentes. Ninguna.",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Losartán 50mg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Colecistectomía (2023)",
        "description": "Hospitalización registrada en antecedentes. Colecistectomía (2023).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Salbutamol inhalador",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Neumonía (2022)",
        "description": "Hospitalización registrada en antecedentes. Neumonía (2022).",
        "doctor": "Médico Asignado",
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
        "type": "Cirugía",
        "title": "Ninguna",
        "description": "Hospitalización registrada en antecedentes. Ninguna.",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Enalapril 10mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 11,
    "name": "Cecilia Ortiz Guzmán",
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
        "type": "Cirugía",
        "title": "Apendicitis (2021)",
        "description": "Hospitalización registrada en antecedentes. Apendicitis (2021).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Levotiroxina 100mcg",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Ninguna",
        "description": "Hospitalización registrada en antecedentes. Ninguna.",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Salbutamol inhalador",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Neumonía (2022)",
        "description": "Hospitalización registrada en antecedentes. Neumonía (2022).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Metformina 850mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 14,
    "name": "Oscar Cárdenas Choque",
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
        "type": "Cirugía",
        "title": "Fractura de brazo (2019)",
        "description": "Hospitalización registrada en antecedentes. Fractura de brazo (2019).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Ácido valproico 500mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 15,
    "name": "Wilson Peredo Ibáñez",
    "documentId": "HC-2026-1004",
    "birthDate": "2000-02-26",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Villazón",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-4.pdf",
    "events": [
      {
        "date": "2018-01-15",
        "type": "Cirugía",
        "title": "Parto (2020)",
        "description": "Hospitalización registrada en antecedentes. Parto (2020).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Enalapril 10mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 16,
    "name": "Ricardo Rojas Ibáñez",
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
        "type": "Cirugía",
        "title": "Colecistectomía (2023)",
        "description": "Hospitalización registrada en antecedentes. Colecistectomía (2023).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Ácido valproico 500mg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 17,
    "name": "Gabriel Flores Ibáñez",
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
        "type": "Cirugía",
        "title": "Fractura de brazo (2019)",
        "description": "Hospitalización registrada en antecedentes. Fractura de brazo (2019).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Salbutamol inhalador",
        "doctor": "Médico Tratante",
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
        "type": "Cirugía",
        "title": "Colecistectomía (2023)",
        "description": "Hospitalización registrada en antecedentes. Colecistectomía (2023).",
        "doctor": "Médico Asignado",
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
        "type": "Cirugía",
        "title": "Ninguna",
        "description": "Hospitalización registrada en antecedentes. Ninguna.",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Levotiroxina 100mcg",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 20,
    "name": "Rosario Cárdenas Paz",
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
        "type": "Cirugía",
        "title": "Neumonía (2022)",
        "description": "Hospitalización registrada en antecedentes. Neumonía (2022).",
        "doctor": "Médico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento crónico",
        "description": "Prescripción de Salbutamol inhalador",
        "doctor": "Médico Tratante",
        "status": "Vigente"
      }
    ]
  }
];
