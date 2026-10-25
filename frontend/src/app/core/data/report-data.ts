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
export type ReportRow = Record<string, string | number | null>;
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

const definitions: Record<string, ReportDefinition> = {
  documents: {
    key: 'documents',
    title: 'Reporte de documentos',
    description: 'Distribución, evolución y estado del repositorio documental del tenant actual.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['APPROVED', 'DRAFT', 'IN_REVIEW', 'ARCHIVED'] },
      { key: 'type', label: 'Tipo documental', type: 'search', placeholder: 'Buscar por tipo...' },
      { key: 'area', label: 'Área', type: 'search', placeholder: 'Buscar por área...' },
      { key: 'owner', label: 'Responsable', type: 'search', placeholder: 'Buscar por nombre...' },
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'document', label: 'Documento' },
      { key: 'code', label: 'Código' },
      { key: 'type', label: 'Tipo' },
      { key: 'area', label: 'Área' },
      { key: 'owner', label: 'Responsable' },
      { key: 'date', label: 'Fecha' },
      { key: 'status', label: 'Estado' },
    ],
    rows: [],
    chartOne: { title: 'Estados documentales', subtitle: 'Documentos según su estado actual', kind: 'donut', groupBy: 'status' },
    chartTwo: { title: 'Evolución temporal', subtitle: 'Actividad documental por periodo', kind: 'line', groupBy: 'date' },
    chartThree: { title: 'Documentos por área', subtitle: 'Distribución del repositorio', kind: 'bars', groupBy: 'area' },
  },
  users: {
    key: 'users',
    title: 'Reporte de usuarios',
    description: 'Actividad operativa y accesos del tenant, sin ranking competitivo entre personas.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      { key: 'area', label: 'Área', type: 'search', placeholder: 'Buscar por área...' },
      { key: 'owner', label: 'Usuario', type: 'search', placeholder: 'Nombre o email...' },
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'user', label: 'Usuario' },
      { key: 'role', label: 'Rol' },
      { key: 'area', label: 'Área' },
      { key: 'lastAccess', label: 'Último acceso' },
      { key: 'actions', label: 'Acciones operativas' },
      { key: 'status', label: 'Estado' },
    ],
    rows: [],
    chartOne: { title: 'Estado de cuentas', subtitle: 'Registrados, activos e inactivos', kind: 'donut', groupBy: 'status' },
    chartTwo: { title: 'Accesos por usuario', subtitle: 'Usuarios con actividad registrada', kind: 'bars', groupBy: 'user' },
    chartThree: { title: 'Actividad operativa', subtitle: 'Acciones por usuario', kind: 'line', groupBy: 'user' },
  },
  workflows: {
    key: 'workflows',
    title: 'Reporte de workflows',
    description: 'Seguimiento de procesos, etapas, tiempos y cuellos de botella del tenant actual.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['RUNNING', 'COMPLETED', 'DRAFT', 'CANCELED', 'FAILED'] },
      { key: 'type', label: 'Tipo de workflow', type: 'search', placeholder: 'Tipo...' },
      { key: 'owner', label: 'Responsable', type: 'search', placeholder: 'Nombre...' },
      { key: 'dateFrom', label: 'Inicio desde *', type: 'date' },
      { key: 'dateTo', label: 'Inicio hasta *', type: 'date' },
    ],
    columns: [
      { key: 'workflow', label: 'Workflow' },
      { key: 'document', label: 'Documento' },
      { key: 'type', label: 'Tipo' },
      { key: 'stage', label: 'Etapa' },
      { key: 'owner', label: 'Responsable' },
      { key: 'start', label: 'Inicio' },
      { key: 'deadline', label: 'Límite' },
      { key: 'elapsed', label: 'Transcurrido' },
      { key: 'status', label: 'Estado' },
    ],
    rows: [],
    chartOne: { title: 'Estado de workflows', subtitle: 'Activos, completados y excepciones', kind: 'bars', groupBy: 'status' },
    chartTwo: { title: 'Completados por fecha', subtitle: 'Evolución del cierre de procesos', kind: 'line', groupBy: 'start' },
    chartThree: { title: 'Tiempo por etapa', subtitle: 'Identificación del cuello de botella', kind: 'bars', groupBy: 'stage' },
  },
  expedients: {
    key: 'expedients',
    title: 'Reporte de expedientes',
    description: 'Estado, tipos y responsables de expedientes del tenant actual.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['OPEN', 'IN_PROCESS', 'CLOSED', 'ARCHIVED'] },
      { key: 'type', label: 'Tipo de expediente', type: 'search', placeholder: 'Tipo...' },
      { key: 'area', label: 'Área', type: 'search', placeholder: 'Área...' },
      { key: 'owner', label: 'Responsable', type: 'search', placeholder: 'Nombre...' },
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'expedient', label: 'Expediente' },
      { key: 'type', label: 'Tipo' },
      { key: 'area', label: 'Área' },
      { key: 'owner', label: 'Responsable' },
      { key: 'date', label: 'Fecha' },
      { key: 'status', label: 'Estado' },
    ],
    rows: [],
    chartOne: { title: 'Estados de expedientes', subtitle: 'Distribución por estado', kind: 'donut', groupBy: 'status' },
    chartTwo: { title: 'Evolución temporal', subtitle: 'Expedientes por fecha', kind: 'line', groupBy: 'date' },
    chartThree: { title: 'Expedientes por área', subtitle: 'Distribución del repositorio', kind: 'bars', groupBy: 'area' },
  },
  audit: {
    key: 'audit',
    title: 'Resumen de auditoría',
    description: 'Vista ejecutiva de eventos, accesos y acciones sensibles del tenant actual.',
    filters: [
      { key: 'action', label: 'Acción', type: 'search', placeholder: 'Ej. LOGIN, CREATE...' },
      { key: 'owner', label: 'Usuario', type: 'search', placeholder: 'Nombre...' },
      { key: 'module', label: 'Módulo', type: 'search', placeholder: 'Entidad...' },
      { key: 'result', label: 'Resultado', type: 'select', options: ['SUCCESS', 'FAILURE'] },
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'user', label: 'Usuario' },
      { key: 'action', label: 'Acción' },
      { key: 'module', label: 'Módulo' },
      { key: 'resource', label: 'Recurso' },
      { key: 'area', label: 'Área' },
      { key: 'ip', label: 'IP' },
      { key: 'result', label: 'Resultado' },
    ],
    rows: [],
    chartOne: { title: 'Tendencia por fecha', subtitle: 'Volumen de eventos registrados', kind: 'line', groupBy: 'timestamp' },
    chartTwo: { title: 'Eventos por acción', subtitle: 'Accesos, modificaciones y descargas', kind: 'bars', groupBy: 'action' },
    chartThree: { title: 'Actividad por módulo', subtitle: 'Superficie operativa auditada', kind: 'donut', groupBy: 'module' },
  },
  ocr: {
    key: 'ocr',
    title: 'Reporte de OCR',
    description: 'Trabajos de digitalización, confianza del motor y resultado de validación del tenant actual.',
    filters: [
      { key: 'status', label: 'Estado', type: 'select', options: ['QUEUED', 'PROCESSING', 'COMPLETED', 'VALIDATED', 'REJECTED', 'FAILED'] },
      { key: 'owner', label: 'Cargado por', type: 'search', placeholder: 'Nombre...' },
      { key: 'search', label: 'Archivo o documento', type: 'search', placeholder: 'Buscar...' },
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'file', label: 'Archivo' },
      { key: 'document', label: 'Documento' },
      { key: 'fileType', label: 'Tipo de archivo' },
      { key: 'uploadedBy', label: 'Cargado por' },
      { key: 'pages', label: 'Páginas' },
      { key: 'confidence', label: 'Confianza' },
      { key: 'date', label: 'Fecha' },
      { key: 'status', label: 'Estado' },
    ],
    rows: [],
    chartOne: { title: 'Estados de trabajos OCR', subtitle: 'Distribución por estado', kind: 'donut', groupBy: 'status' },
    chartTwo: { title: 'Trabajos por fecha', subtitle: 'Volumen de digitalización', kind: 'line', groupBy: 'date' },
    chartThree: { title: 'Tipos de archivo', subtitle: 'Formatos procesados', kind: 'bars', groupBy: 'fileType' },
  },
  productivity: {
    key: 'productivity',
    title: 'Analítica y Business Intelligence',
    description: 'Tablero de inteligencia de negocios: tiempos de ciclo, cuellos de botella y rendimiento institucional.',
    filters: [
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'metric', label: 'Indicador' },
      { key: 'value', label: 'Valor' },
      { key: 'detail', label: 'Detalle' },
    ],
    rows: [],
    chartOne: { title: 'Evolución mensual', subtitle: 'Documentos creados y aprobados', kind: 'line', groupBy: 'month' },
    chartTwo: { title: 'Tiempos de ciclo', subtitle: 'Horas promedio por plantilla de workflow', kind: 'bars', groupBy: 'template' },
    chartThree: { title: 'Distribución por área', subtitle: 'Concentración institucional', kind: 'donut', groupBy: 'area' },
  },
  areas: {
    key: 'areas',
    title: 'Actividad por área',
    description: 'Distribución documental y operativa por departamento institucional.',
    filters: [
      { key: 'dateFrom', label: 'Desde *', type: 'date' },
      { key: 'dateTo', label: 'Hasta *', type: 'date' },
    ],
    columns: [
      { key: 'area', label: 'Área' },
      { key: 'documents', label: 'Documentos' },
    ],
    rows: [],
    chartOne: { title: 'Distribución documental', subtitle: 'Concentración por área', kind: 'donut', groupBy: 'area' },
    chartTwo: { title: 'Volumen por departamento', subtitle: 'Total documentos', kind: 'bars', groupBy: 'area' },
  },
};

export function reportDefinition(key: string): ReportDefinition {
  return definitions[key] ?? definitions['documents'];
}

export const CHART_COLORS = ['#087f7b', '#4d9bd8', '#79c4bb', '#e3a633', '#7e5ab0', '#d76a6a', '#8aa19f'];

/** Valor numérico finito o el valor por defecto; nunca NaN ni Infinity. */
export function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Normaliza una etiqueta de grupo: fechas con hora quedan como día, vacíos como "Sin dato". */
export function groupLabel(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return 'Sin dato';
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}[ T]/.test(text) ? text.slice(0, 10) : text;
}

/**
 * Agrupa filas por una columna y cuenta una fila por ocurrencia (valor 1). Solo si la columna es
 * numérica por definición ("documents" en el reporte de áreas) suma ese valor, siempre finito.
 */
export function chartPointsFromRows(rows: ReportRow[], groupBy: string, sumKey?: string): ChartPoint[] {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = groupLabel(row[groupBy]);
    const value = sumKey ? finiteNumber(row[sumKey], 1) : 1;
    grouped.set(label, (grouped.get(label) ?? 0) + value);
  }
  return Array.from(grouped.entries()).map(([label, value], index) => ({
    label,
    value,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

/** Texto de una celda: null/undefined se muestran como guion largo (componente oculto o sin dato). */
export function cellText(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

/** Nombre de organización y rol visibles en el encabezado, tomados de la sesión autenticada. */
export function sessionLabels(user: { tenantName?: string | null; platformAdmin?: boolean; roleNames?: string[] } | null | undefined): { tenant: string; role: string } {
  if (!user) return { tenant: 'Organización autenticada', role: '' };
  return {
    tenant: user.tenantName?.trim() || 'Organización autenticada',
    role: user.platformAdmin ? 'Superadministrador' : (user.roleNames ?? []).filter(Boolean).join(', '),
  };
}
