import { DemoItem, Role, RouteInfo, ScreenCopy } from './data.types';
import { documents, expedients, workflows } from './documents.data';
import { navigationRoutes } from './navigation.data';

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

export const rolesItems: DemoItem[] = [
  { title: 'Administrador de tenant', meta: 'ROL-ADM · Control total sobre usuarios, documentos, flujos y auditoría del tenant', date: '3 usuarios · Sistema', status: 'Activo' },
  { title: 'Supervisor de área', meta: 'ROL-SUP · Aprobación de expedientes, supervisión de flujos y validación de tareas', date: '5 usuarios · Operativo', status: 'Activo' },
  { title: 'Operador documental', meta: 'ROL-DOC · Creación, carga de archivos, edición de metadatos e indexación OCR', date: '14 usuarios · Estándar', status: 'Activo' },
  { title: 'Auditor de calidad', meta: 'ROL-AUD · Consulta de registros de auditoría, trazabilidad y reportes de seguridad', date: '2 usuarios · Especial', status: 'Activo' },
  { title: 'Usuario de consulta', meta: 'ROL-CON · Acceso de solo lectura a documentos aprobados y expedientes públicos', date: '8 usuarios · Básico', status: 'Activo' },
];

export const permissionsItems: DemoItem[] = [
  { title: 'document:create', meta: 'DOC-01 · Permite crear y clasificar nuevos documentos en el repositorio institucional', date: 'Módulo Documentos · Total', status: 'Activo' },
  { title: 'document:approve', meta: 'DOC-02 · Autorización y firma para pasar documentos a estado Aprobado o Vigente', date: 'Módulo Flujos · Supervisor', status: 'Activo' },
  { title: 'document:version_upload', meta: 'DOC-03 · Carga de nuevas versiones físicas (.pdf, .docx, .png, .jpg)', date: 'Módulo Archivos · Estándar', status: 'Activo' },
  { title: 'expedient:manage', meta: 'EXP-01 · Creación, cierre, foliación y vinculación de expedientes documentales', date: 'Módulo Expedientes · Total', status: 'Activo' },
  { title: 'audit:view', meta: 'AUD-01 · Lectura inmutable del historial de eventos y accesos del sistema', date: 'Módulo Auditoría · Auditor', status: 'Activo' },
  { title: 'user:manage', meta: 'USR-01 · Alta, edición de roles y suspensión de usuarios del tenant', date: 'Módulo Gestión · Admin', status: 'Activo' },
  { title: 'ocr:validate', meta: 'OCR-01 · Revisión y confirmación de extracción de datos OCR en lote', date: 'Módulo Digitalización · Operador', status: 'Activo' },
];

export const notificationsItems: DemoItem[] = [
  { title: 'Aprobación de contrato marco #892', meta: 'Contrato marco proveedores · Etapa 2 de 4 · Legal · Asignado por Carlos Méndez', date: 'Hace 15 min', status: 'No leída', type: 'APR' },
  { title: 'Nueva versión de política de seguridad cargada', meta: 'DOC-2041 v2.1 · Archivo PDF actualizado por María González · Área Dirección', date: 'Hace 1 hora', status: 'No leída', type: 'DOC' },
  { title: 'Te mencionaron en el expediente EXP-2041', meta: 'Laura, por favor revisa el anexo técnico antes del cierre del expediente · Compras', date: 'Hace 2 horas', status: 'No leída', type: 'MEN' },
  { title: 'Vencimiento próximo: Revisión de acta de entrega', meta: 'Tarea #104 vence mañana a las 18:00 · Operaciones · Prioridad Alta', date: 'Ayer, 18:40', status: 'No leída', type: 'TSK' },
  { title: 'Solicitud de firma digital para orden de compra #1204', meta: 'Requiere firma electrónica avanzada antes del procesamiento contable · Finanzas', date: 'Ayer, 14:15', status: 'No leída', type: 'APR' },
  { title: 'Alerta de procesamiento OCR completado', meta: 'Lote OCR-2026-0098 procesado con 94.2% de confianza · 4 páginas indexadas', date: '24/09/2026, 11:20', status: 'No leída', type: 'SIS' },
  { title: 'Tarea completada: Alta de proveedor Andes', meta: 'Validación fiscal y técnica aprobada exitosamente por supervisor', date: '23/09/2026, 16:30', status: 'Leída', type: 'TSK' },
  { title: 'Mención en informe de auditoría Q2', meta: '@laura.martinez se adjuntaron las observaciones del cierre de periodo', date: '22/09/2026, 09:10', status: 'Leída', type: 'MEN' },
  { title: 'Aprobación final: Manual de incorporación', meta: 'El documento fue aprobado y publicado en el repositorio institucional', date: '20/09/2026, 15:00', status: 'Leída', type: 'APR' },
];

export function screenCopy(route: RouteInfo): ScreenCopy {
  const action = route.subcategory.includes('Crear') || route.subcategory.includes('Nuevo')
    ? route.subcategory
    : route.subcategory.includes('Subir')
      ? 'Seleccionar archivo'
      : route.subcategory === 'Roles'
        ? 'Nuevo rol'
        : route.subcategory === 'Permisos'
          ? 'Crear permiso'
          : route.module === 'Notificaciones'
            ? 'Marcar todo leído'
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

export function demoList(module: string, subcategory?: string): DemoItem[] {
  if (subcategory === 'Roles' || subcategory?.toLowerCase().includes('roles')) return rolesItems;
  if (subcategory === 'Permisos' || subcategory?.toLowerCase().includes('permis') || subcategory?.toLowerCase().includes('permission')) return permissionsItems;
  if (module === 'Notificaciones') {
    if (subcategory === 'No leidas' || subcategory?.toLowerCase().includes('no leida') || subcategory?.toLowerCase().includes('unread')) {
      return notificationsItems.filter((n) => n.status === 'No leída');
    }
    if (subcategory === 'Tareas' || subcategory?.toLowerCase().includes('tarea') || subcategory?.toLowerCase().includes('task')) {
      return notificationsItems.filter((n) => n.type === 'TSK');
    }
    if (subcategory === 'Aprobaciones' || subcategory?.toLowerCase().includes('aprob') || subcategory?.toLowerCase().includes('approval')) {
      return notificationsItems.filter((n) => n.type === 'APR');
    }
    if (subcategory === 'Menciones' || subcategory?.toLowerCase().includes('mencion') || subcategory?.toLowerCase().includes('mention')) {
      return notificationsItems.filter((n) => n.type === 'MEN');
    }
    return notificationsItems;
  }
  if (module === 'Documentos' || module === 'Digitalizacion') return documents;
  if (module === 'Expedientes') return expedients;
  if (module === 'Workflows') return workflows;
  if (module === 'Usuarios y equipos') return users;
  if (module === 'Tenants') return tenants;
  return documents;
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
  'Notificaciones|Todas': 'Bandeja general de avisos, alertas y eventos en tiempo real del tenant.',
  'Notificaciones|No leidas': 'Notificaciones nuevas que todavía requieren tu atención o lectura.',
  'Notificaciones|Tareas': 'Avisos sobre asignaciones de tareas, vencimientos y estados de flujo.',
  'Notificaciones|Aprobaciones': 'Solicitudes de aprobación de documentos, firmas y autorizaciones pendientes.',
  'Notificaciones|Menciones': 'Comentarios y referencias directas a tu usuario en documentos y expedientes.',
  'Configuracion|General': 'Datos institucionales y preferencias generales del tenant autenticado.',
  'Tenants|Todos los tenants': 'Administra las organizaciones aisladas registradas en la plataforma.',
  'Expedientes|Expediente clínico': 'Visualiza la historia clínica del paciente ordenada cronológicamente por fecha y evento.',
  'Expedientes|Notas médicas': 'Busca pacientes por documento de identidad o nombre y registra notas de evolución.',
  'Módulo Clínico|Pacientes': 'Gestiona el registro e identificación unívoca de pacientes.',
  'Módulo Clínico|Antecedentes': 'Captura estructurada de diagnósticos base, alergias y antecedentes.',
};
