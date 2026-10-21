export type ReportFilterType = 'select' | 'date' | 'search';
export type ReportChartKind = 'bars' | 'line' | 'donut';

export type ReportFilter = {
  key: string;
  label: string;
  type: ReportFilterType;
  options?: string[];
  placeholder?: string;
};

export type ReportColumn = { key: string; label: string };
export type ReportRow = Record<string, string | number>;
export type ChartPoint = { label: string; value: number; color?: string };

export type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  filters: ReportFilter[];
  columns: ReportColumn[];
  rows: ReportRow[];
  chartOne: { title: string; subtitle: string; kind: ReportChartKind; groupBy: string };
  chartTwo: { title: string; subtitle: string; kind: ReportChartKind; groupBy: string };
  chartThree?: { title: string; subtitle: string; kind: ReportChartKind; groupBy: string };
};

const documents: ReportRow[] = [
  { document: 'Política de seguridad', code: 'DOC-2041', type: 'Política', area: 'Dirección', owner: 'María González', date: '2026-09-16', status: 'Aprobado', month: 'Abr', stateValue: 38, areaValue: 32 },
  { document: 'Contrato marco proveedores', code: 'DOC-2042', type: 'Contrato', area: 'Legal', owner: 'Carlos Méndez', date: '2026-09-15', status: 'En revisión', month: 'May', stateValue: 26, areaValue: 28 },
  { document: 'Informe auditoría interna', code: 'DOC-2043', type: 'Informe', area: 'Calidad', owner: 'Javier Ruiz', date: '2026-09-12', status: 'Pendiente', month: 'Jun', stateValue: 17, areaValue: 22 },
  { document: 'Manual de incorporación', code: 'DOC-2044', type: 'Manual', area: 'Recursos Humanos', owner: 'Ana López', date: '2026-09-08', status: 'Aprobado', month: 'Jul', stateValue: 31, areaValue: 18 },
  { document: 'Solicitud de compra', code: 'DOC-2045', type: 'Solicitud', area: 'Compras', owner: 'Ana López', date: '2026-09-04', status: 'Archivado', month: 'Ago', stateValue: 12, areaValue: 25 },
  { document: 'Acta comité operativo', code: 'DOC-2046', type: 'Acta', area: 'Operaciones', owner: 'Laura Martínez', date: '2026-08-30', status: 'Aprobado', month: 'Sep', stateValue: 34, areaValue: 20 },
  { document: 'Política de retención', code: 'DOC-2047', type: 'Política', area: 'Legal', owner: 'Carlos Méndez', date: '2026-08-25', status: 'En revisión', month: 'Oct', stateValue: 22, areaValue: 28 },
  { document: 'Evaluación de proveedores', code: 'DOC-2048', type: 'Informe', area: 'Compras', owner: 'María González', date: '2026-08-20', status: 'Pendiente', month: 'Nov', stateValue: 15, areaValue: 25 },
  { document: 'Guía de continuidad', code: 'DOC-2049', type: 'Manual', area: 'Tecnología', owner: 'Javier Ruiz', date: '2026-08-14', status: 'Aprobado', month: 'Dic', stateValue: 29, areaValue: 14 },
  { document: 'Acuerdo de servicio', code: 'DOC-2050', type: 'Contrato', area: 'Legal', owner: 'Laura Martínez', date: '2026-08-06', status: 'Aprobado', month: 'Ene', stateValue: 36, areaValue: 28 },
  { document: 'Plan de capacitación', code: 'DOC-2051', type: 'Plan', area: 'Recursos Humanos', owner: 'Ana López', date: '2026-07-29', status: 'Pendiente', month: 'Feb', stateValue: 14, areaValue: 18 },
  { document: 'Registro de entrega', code: 'DOC-2052', type: 'Acta', area: 'Operaciones', owner: 'Carlos Méndez', date: '2026-07-22', status: 'Archivado', month: 'Mar', stateValue: 10, areaValue: 20 },
];

const users: ReportRow[] = [
  { user: 'Laura Martínez', role: 'Administradora', area: 'Dirección', lastAccess: 'Hoy, 09:42', actions: 42, status: 'Activo', period: 'Hoy', newUser: 'Sí', activityValue: 42 },
  { user: 'Carlos Méndez', role: 'Supervisor', area: 'Legal', lastAccess: 'Hoy, 08:31', actions: 35, status: 'Activo', period: 'Hoy', activityValue: 35 },
  { user: 'Ana López', role: 'Usuario operativo', area: 'Archivo', lastAccess: 'Ayer, 17:20', actions: 21, status: 'Activo', period: 'Esta semana', activityValue: 21 },
  { user: 'Javier Ruiz', role: 'Auditor', area: 'Calidad', lastAccess: '12 sep 2026', actions: 8, status: 'Bloqueado', period: 'Este mes', activityValue: 8 },
  { user: 'María González', role: 'Supervisora', area: 'Compras', lastAccess: '11 sep 2026', actions: 29, status: 'Activo', period: 'Esta semana', newUser: 'Sí', activityValue: 29 },
  { user: 'Diego Torres', role: 'Usuario operativo', area: 'Operaciones', lastAccess: '06 sep 2026', actions: 11, status: 'Inactivo', period: 'Este mes', activityValue: 11 },
  { user: 'Sofía Pérez', role: 'Usuario operativo', area: 'Tecnología', lastAccess: '03 sep 2026', actions: 17, status: 'Activo', period: 'Este mes', activityValue: 17 },
  { user: 'Andrés Castro', role: 'Supervisor', area: 'Legal', lastAccess: '01 sep 2026', actions: 24, status: 'Activo', period: 'Este mes', activityValue: 24 },
];

const workflows: ReportRow[] = [
  { workflow: 'Aprobación de contratos', document: 'DOC-2042', type: 'Aprobación', stage: 'Revisión legal', owner: 'Carlos Méndez', start: '2026-09-15', deadline: '2026-09-18', elapsed: '1 d 4 h', status: 'Activo', month: 'Jun', stageValue: 34 },
  { workflow: 'Alta de proveedor', document: 'EXP-2041', type: 'Alta', stage: 'Validación de compras', owner: 'María González', start: '2026-09-12', deadline: '2026-09-17', elapsed: '3 d', status: 'Pendiente', month: 'Jul', stageValue: 27 },
  { workflow: 'Revisión trimestral', document: 'DOC-2043', type: 'Auditoría', stage: 'Cierre', owner: 'Javier Ruiz', start: '2026-08-30', deadline: '2026-09-05', elapsed: '5 d', status: 'Completado', month: 'Ago', stageValue: 18 },
  { workflow: 'Publicación de políticas', document: 'DOC-2041', type: 'Publicación', stage: 'Aprobación final', owner: 'Laura Martínez', start: '2026-08-26', deadline: '2026-09-02', elapsed: '4 d', status: 'Completado', month: 'Sep', stageValue: 22 },
  { workflow: 'Revisión de seguridad', document: 'DOC-2047', type: 'Revisión', stage: 'Seguridad', owner: 'Laura Martínez', start: '2026-09-03', deadline: '2026-09-09', elapsed: '8 d', status: 'Vencido', month: 'Oct', stageValue: 42 },
  { workflow: 'Actualización documental', document: 'DOC-2049', type: 'Actualización', stage: 'Metadatos', owner: 'Ana López', start: '2026-09-01', deadline: '2026-09-12', elapsed: '7 d', status: 'Cancelado', month: 'Nov', stageValue: 13 },
  { workflow: 'Validación de expediente', document: 'EXP-2038', type: 'Expediente', stage: 'Control de calidad', owner: 'Javier Ruiz', start: '2026-08-19', deadline: '2026-08-27', elapsed: '6 d', status: 'Completado', month: 'Dic', stageValue: 31 },
  { workflow: 'Firma de acuerdo', document: 'DOC-2050', type: 'Firma', stage: 'Firma electrónica', owner: 'Carlos Méndez', start: '2026-09-10', deadline: '2026-09-16', elapsed: '4 d', status: 'Activo', month: 'Ene', stageValue: 24 },
];

const storage: ReportRow[] = [
  { category: 'Documentos PDF', files: 428, size: '2.8 GB', used: 2.8, percentage: 41, growth: '+8.4%', area: 'Todas', month: 'Jun', growthValue: 8 },
  { category: 'Imágenes y escaneos', files: 236, size: '1.7 GB', used: 1.7, percentage: 25, growth: '+12.1%', area: 'Archivo', month: 'Jul', growthValue: 12 },
  { category: 'Documentos Office', files: 312, size: '1.2 GB', used: 1.2, percentage: 18, growth: '+5.7%', area: 'Operaciones', month: 'Ago', growthValue: 6 },
  { category: 'Hojas de cálculo', files: 106, size: '0.7 GB', used: 0.7, percentage: 10, growth: '+3.2%', area: 'Finanzas', month: 'Sep', growthValue: 3 },
  { category: 'Presentaciones', files: 48, size: '0.3 GB', used: 0.3, percentage: 4, growth: '+1.8%', area: 'Dirección', month: 'Oct', growthValue: 2 },
  { category: 'Otros formatos', files: 74, size: '0.1 GB', used: 0.1, percentage: 2, growth: '+2.4%', area: 'Legal', month: 'Nov', growthValue: 2 },
];

const audit: ReportRow[] = [
  { timestamp: '16 sep, 09:42', user: 'Laura Martínez', action: 'Inicio de sesión', module: 'Accesos', resource: 'NexoDocs', area: 'Dirección', ip: '10.24.8.12', result: 'Exitoso', day: 'Lun', actionValue: 42 },
  { timestamp: '16 sep, 09:31', user: 'Carlos Méndez', action: 'Modificación', module: 'Documentos', resource: 'DOC-2042', area: 'Legal', ip: '10.24.8.18', result: 'Exitoso', day: 'Mar', actionValue: 28 },
  { timestamp: '16 sep, 09:17', user: 'Javier Ruiz', action: 'Descarga', module: 'Documentos', resource: 'DOC-2043', area: 'Calidad', ip: '10.24.8.23', result: 'Fallido', day: 'Mié', actionValue: 17 },
  { timestamp: '15 sep, 17:03', user: 'Ana López', action: 'Creación', module: 'Documentos', resource: 'DOC-2051', area: 'Archivo', ip: '10.24.8.31', result: 'Exitoso', day: 'Jue', actionValue: 23 },
  { timestamp: '15 sep, 16:42', user: 'María González', action: 'Cambio de permisos', module: 'Usuarios', resource: 'grupo-compras', area: 'Compras', ip: '10.24.8.9', result: 'Crítico', day: 'Vie', actionValue: 9 },
  { timestamp: '15 sep, 15:18', user: 'Diego Torres', action: 'Inicio de sesión', module: 'Accesos', resource: 'NexoDocs', area: 'Operaciones', ip: '10.24.8.41', result: 'Fallido', day: 'Sáb', actionValue: 14 },
  { timestamp: '14 sep, 12:11', user: 'Sofía Pérez', action: 'Modificación', module: 'Workflows', resource: 'WF-1008', area: 'Tecnología', ip: '10.24.8.52', result: 'Exitoso', day: 'Dom', actionValue: 19 },
  { timestamp: '13 sep, 11:06', user: 'Laura Martínez', action: 'Descarga', module: 'Documentos', resource: 'DOC-2041', area: 'Dirección', ip: '10.24.8.12', result: 'Exitoso', day: 'Lun', actionValue: 25 },
];

const productivity: ReportRow[] = [
  { user: 'Laura Martínez', area: 'Dirección', assigned: 28, completed: 24, pending: 3, overdue: 1, avgTime: '1.8 d', workflow: 'Aprobación', month: 'Jun', completedValue: 24 },
  { user: 'Carlos Méndez', area: 'Legal', assigned: 25, completed: 20, pending: 3, overdue: 2, avgTime: '2.1 d', workflow: 'Revisión', month: 'Jul', completedValue: 20 },
  { user: 'Ana López', area: 'Archivo', assigned: 19, completed: 16, pending: 2, overdue: 1, avgTime: '1.5 d', workflow: 'Indexación', month: 'Ago', completedValue: 16 },
  { user: 'María González', area: 'Compras', assigned: 22, completed: 18, pending: 3, overdue: 1, avgTime: '2.4 d', workflow: 'Alta', month: 'Sep', completedValue: 18 },
  { user: 'Javier Ruiz', area: 'Calidad', assigned: 17, completed: 12, pending: 2, overdue: 3, avgTime: '3.2 d', workflow: 'Auditoría', month: 'Oct', completedValue: 12 },
  { user: 'Diego Torres', area: 'Operaciones', assigned: 14, completed: 11, pending: 2, overdue: 1, avgTime: '2.7 d', workflow: 'Actualización', month: 'Nov', completedValue: 11 },
  { user: 'Sofía Pérez', area: 'Tecnología', assigned: 16, completed: 13, pending: 2, overdue: 1, avgTime: '2.0 d', workflow: 'Seguridad', month: 'Dic', completedValue: 13 },
];

const byArea: ReportRow[] = [
  { area: 'Dirección', documents: 186, workflows: 22, tasks: 64, users: 8, monthly: 42, pending: 5, month: 'Jun', activityValue: 42 },
  { area: 'Legal', documents: 274, workflows: 34, tasks: 88, users: 12, monthly: 58, pending: 11, month: 'Jul', activityValue: 58 },
  { area: 'Compras', documents: 218, workflows: 27, tasks: 71, users: 9, monthly: 51, pending: 8, month: 'Ago', activityValue: 51 },
  { area: 'Calidad', documents: 156, workflows: 18, tasks: 49, users: 7, monthly: 37, pending: 6, month: 'Sep', activityValue: 37 },
  { area: 'Operaciones', documents: 243, workflows: 29, tasks: 79, users: 14, monthly: 63, pending: 13, month: 'Oct', activityValue: 63 },
  { area: 'Archivo', documents: 171, workflows: 16, tasks: 42, users: 6, monthly: 31, pending: 4, month: 'Nov', activityValue: 31 },
];

const definitions: Record<string, ReportDefinition> = {
  documents: {
    key: 'documents', title: 'Reporte de documentos', description: 'Distribución, evolución y estado del repositorio documental del tenant actual.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['Aprobado', 'En revisión', 'Pendiente', 'Archivado'] },
      { key: 'type', label: 'Tipo documental', type: 'select', options: ['Política', 'Contrato', 'Informe', 'Manual', 'Solicitud', 'Acta', 'Plan'] },
      { key: 'area', label: 'Área', type: 'select', options: ['Dirección', 'Legal', 'Calidad', 'Recursos Humanos', 'Compras', 'Operaciones', 'Tecnología'] },
      { key: 'owner', label: 'Responsable', type: 'select', options: ['María González', 'Carlos Méndez', 'Javier Ruiz', 'Ana López', 'Laura Martínez'] },
      { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' },
    ],
    columns: [{ key: 'document', label: 'Documento' }, { key: 'code', label: 'Código' }, { key: 'type', label: 'Tipo' }, { key: 'area', label: 'Área' }, { key: 'owner', label: 'Responsable' }, { key: 'date', label: 'Fecha' }, { key: 'status', label: 'Estado' }],
    rows: documents, chartOne: { title: 'Estados documentales', subtitle: 'Documentos según su estado actual', kind: 'donut', groupBy: 'status' }, chartTwo: { title: 'Evolución temporal', subtitle: 'Actividad documental por periodo', kind: 'line', groupBy: 'month' }, chartThree: { title: 'Documentos por área', subtitle: 'Distribución del repositorio', kind: 'bars', groupBy: 'area' },
  },
  users: {
    key: 'users', title: 'Reporte de usuarios', description: 'Actividad operativa y accesos del tenant, sin ranking competitivo entre personas.',
    filters: [{ key: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Inactivo', 'Bloqueado'] }, { key: 'role', label: 'Rol', type: 'select', options: ['Administradora', 'Supervisor', 'Supervisora', 'Usuario operativo', 'Auditor'] }, { key: 'area', label: 'Área', type: 'select', options: ['Dirección', 'Legal', 'Archivo', 'Calidad', 'Compras', 'Operaciones', 'Tecnología'] }, { key: 'period', label: 'Periodo de acceso', type: 'select', options: ['Hoy', 'Esta semana', 'Este mes'] }],
    columns: [{ key: 'user', label: 'Usuario' }, { key: 'role', label: 'Rol' }, { key: 'area', label: 'Área' }, { key: 'lastAccess', label: 'Último acceso' }, { key: 'actions', label: 'Acciones operativas' }, { key: 'status', label: 'Estado' }],
    rows: users, chartOne: { title: 'Estado de cuentas', subtitle: 'Registrados, activos e inactivos', kind: 'donut', groupBy: 'status' }, chartTwo: { title: 'Accesos por periodo', subtitle: 'Usuarios con actividad registrada', kind: 'bars', groupBy: 'period' }, chartThree: { title: 'Actividad operativa', subtitle: 'Acciones por usuario, sin ranking', kind: 'line', groupBy: 'user' },
  },
  workflows: {
    key: 'workflows', title: 'Reporte de workflows', description: 'Seguimiento de procesos, etapas, tiempos y cuellos de botella del tenant actual.',
    filters: [{ key: 'status', label: 'Estado', type: 'select', options: ['Activo', 'Completado', 'Pendiente', 'Vencido', 'Cancelado'] }, { key: 'type', label: 'Tipo de workflow', type: 'select', options: ['Aprobación', 'Alta', 'Auditoría', 'Publicación', 'Revisión', 'Actualización', 'Expediente', 'Firma'] }, { key: 'owner', label: 'Responsable', type: 'select', options: ['Carlos Méndez', 'María González', 'Javier Ruiz', 'Laura Martínez', 'Ana López'] }, { key: 'dateFrom', label: 'Inicio desde', type: 'date' }, { key: 'dateTo', label: 'Inicio hasta', type: 'date' }],
    columns: [{ key: 'workflow', label: 'Workflow' }, { key: 'document', label: 'Documento' }, { key: 'type', label: 'Tipo' }, { key: 'stage', label: 'Etapa' }, { key: 'owner', label: 'Responsable' }, { key: 'start', label: 'Inicio' }, { key: 'deadline', label: 'Límite' }, { key: 'elapsed', label: 'Transcurrido' }, { key: 'status', label: 'Estado' }],
    rows: workflows, chartOne: { title: 'Estado de workflows', subtitle: 'Activos, completados y excepciones', kind: 'bars', groupBy: 'status' }, chartTwo: { title: 'Completados por mes', subtitle: 'Evolución del cierre de procesos', kind: 'line', groupBy: 'month' }, chartThree: { title: 'Tiempo por etapa', subtitle: 'Identificación del cuello de botella', kind: 'bars', groupBy: 'stage' },
  },
  storage: {
    key: 'storage', title: 'Reporte de almacenamiento', description: 'Uso, capacidad, crecimiento y distribución de archivos del tenant actual.',
    filters: [{ key: 'area', label: 'Área propietaria', type: 'select', options: ['Todas', 'Archivo', 'Operaciones', 'Finanzas', 'Dirección', 'Legal'] }, { key: 'category', label: 'Categoría', type: 'select', options: ['Documentos PDF', 'Imágenes y escaneos', 'Documentos Office', 'Hojas de cálculo', 'Presentaciones', 'Otros formatos'] }, { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' }],
    columns: [{ key: 'category', label: 'Categoría' }, { key: 'files', label: 'Archivos' }, { key: 'size', label: 'Tamaño' }, { key: 'percentage', label: '% usado' }, { key: 'growth', label: 'Crecimiento' }],
    rows: storage, chartOne: { title: 'Uso por tipo de archivo', subtitle: 'Distribución del espacio utilizado', kind: 'bars', groupBy: 'category' }, chartTwo: { title: 'Crecimiento mensual', subtitle: 'Variación relativa del consumo', kind: 'line', groupBy: 'month' },
  },
  audit: {
    key: 'audit', title: 'Resumen de auditoría', description: 'Vista ejecutiva de eventos, accesos y acciones sensibles del tenant actual.',
    filters: [{ key: 'action', label: 'Acción', type: 'select', options: ['Inicio de sesión', 'Modificación', 'Descarga', 'Creación', 'Cambio de permisos'] }, { key: 'user', label: 'Usuario', type: 'select', options: ['Laura Martínez', 'Carlos Méndez', 'Javier Ruiz', 'Ana López', 'María González', 'Diego Torres', 'Sofía Pérez'] }, { key: 'module', label: 'Módulo', type: 'select', options: ['Accesos', 'Documentos', 'Usuarios', 'Workflows'] }, { key: 'result', label: 'Resultado', type: 'select', options: ['Exitoso', 'Fallido', 'Crítico'] }, { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' }],
    columns: [{ key: 'timestamp', label: 'Timestamp' }, { key: 'user', label: 'Usuario' }, { key: 'action', label: 'Acción' }, { key: 'module', label: 'Módulo' }, { key: 'resource', label: 'Recurso' }, { key: 'area', label: 'Área' }, { key: 'ip', label: 'IP' }, { key: 'result', label: 'Resultado' }],
    rows: audit, chartOne: { title: 'Tendencia por día', subtitle: 'Volumen de eventos registrados', kind: 'line', groupBy: 'day' }, chartTwo: { title: 'Eventos por acción', subtitle: 'Accesos, modificaciones y descargas', kind: 'bars', groupBy: 'action' }, chartThree: { title: 'Actividad por módulo', subtitle: 'Superficie operativa auditada', kind: 'donut', groupBy: 'module' },
  },
  productivity: {
    key: 'productivity', title: 'Reporte de productividad', description: 'Tareas, tiempos y workflows completados con foco en actividad operativa, no competencia.',
    filters: [{ key: 'area', label: 'Área', type: 'select', options: ['Dirección', 'Legal', 'Archivo', 'Compras', 'Calidad', 'Operaciones', 'Tecnología'] }, { key: 'workflow', label: 'Workflow', type: 'select', options: ['Aprobación', 'Revisión', 'Indexación', 'Alta', 'Auditoría', 'Actualización', 'Seguridad'] }, { key: 'user', label: 'Usuario', type: 'select', options: ['Laura Martínez', 'Carlos Méndez', 'Ana López', 'María González', 'Javier Ruiz', 'Diego Torres', 'Sofía Pérez'] }, { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' }],
    columns: [{ key: 'user', label: 'Usuario' }, { key: 'area', label: 'Área' }, { key: 'assigned', label: 'Asignadas' }, { key: 'completed', label: 'Completadas' }, { key: 'pending', label: 'Pendientes' }, { key: 'overdue', label: 'Vencidas' }, { key: 'avgTime', label: 'Tiempo medio' }, { key: 'workflow', label: 'Workflow' }],
    rows: productivity, chartOne: { title: 'Completadas vs vencidas', subtitle: 'Estado de tareas operativas', kind: 'bars', groupBy: 'user' }, chartTwo: { title: 'Evolución de actividad', subtitle: 'Tareas completadas por periodo', kind: 'line', groupBy: 'month' },
  },
  areas: {
    key: 'areas', title: 'Actividad por área', description: 'Comparativa operativa por área con detalle de documentos, workflows, tareas y usuarios.',
    filters: [{ key: 'area', label: 'Área', type: 'select', options: ['Dirección', 'Legal', 'Compras', 'Calidad', 'Operaciones', 'Archivo'] }, { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' }],
    columns: [{ key: 'area', label: 'Área' }, { key: 'documents', label: 'Documentos' }, { key: 'workflows', label: 'Workflows' }, { key: 'tasks', label: 'Tareas' }, { key: 'users', label: 'Usuarios' }, { key: 'pending', label: 'Pendientes' }],
    rows: byArea, chartOne: { title: 'Documentos por área', subtitle: 'Volumen documental registrado', kind: 'bars', groupBy: 'area' }, chartTwo: { title: 'Actividad mensual', subtitle: 'Eventos operativos por periodo', kind: 'line', groupBy: 'month' }, chartThree: { title: 'Workflows por área', subtitle: 'Procesos en seguimiento', kind: 'donut', groupBy: 'area' },
  },
};

export function reportDefinition(key: string): ReportDefinition {
  return definitions[key] ?? definitions['documents'];
}
