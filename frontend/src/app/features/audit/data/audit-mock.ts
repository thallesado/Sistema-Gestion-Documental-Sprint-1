export type AuditView =
  | 'general'
  | 'access'
  | 'creation'
  | 'modifications'
  | 'downloads'
  | 'approvals'
  | 'deletions'
  | 'permissions';

export type AuditResult = 'Exitoso' | 'Rechazado' | 'Pendiente' | 'En revisión';

export interface AuditEvent {
  id: string;
  timestamp: string;
  dateLabel: string;
  user: string;
  role: string;
  tenant: string;
  module: string;
  action: string;
  resource: string;
  ip: string;
  device: string;
  browser: string;
  result: AuditResult;
  details: string;
  icon: string;
  tone: 'teal' | 'blue' | 'amber' | 'rose' | 'purple';
  before?: Record<string, string>;
  after?: Record<string, string>;
}

export interface AccessSession {
  id: string;
  user: string;
  role: string;
  status: 'Activa' | 'Cerrada' | 'Bloqueada';
  start: string;
  end: string;
  duration: string;
  actions: number;
  device: string;
  ip: string;
  browser: string;
  tenant: string;
}

export interface CreationActivity {
  id: string;
  dateLabel: string;
  date: string;
  document: string;
  type: string;
  creator: string;
  area: string;
  origin: string;
  status: 'Publicado' | 'Borrador' | 'En revisión';
  tenant: string;
}

export interface ModificationRecord {
  id: string;
  timestamp: string;
  document: string;
  user: string;
  role: string;
  version: string;
  previousVersion: string;
  summary: string;
  fields: Array<{ field: string; before: string; after: string }>;
  tenant: string;
}

export interface DownloadRecord {
  id: string;
  document: string;
  version: string;
  type: string;
  user: string;
  role: string;
  date: string;
  ip: string;
  device: string;
  browser: string;
  size: string;
  tenant: string;
}

export interface ApprovalRecord {
  id: string;
  date: string;
  workflow: string;
  document: string;
  status: 'Aprobado' | 'Pendiente' | 'Rechazado';
  duration: string;
  currentStep: number;
  steps: string[];
  participants: string[];
  user: string;
  tenant: string;
}

export interface DeletionRecord {
  id: string;
  date: string;
  resource: string;
  kind: 'Soft delete' | 'Anulación' | 'Archivado';
  deletedBy: string;
  reason: string;
  status: 'Ejecutado' | 'Revisar';
  restoreAllowed: boolean;
  tenant: string;
}

export interface PermissionRecord {
  id: string;
  date: string;
  affectedUser: string;
  modifiedBy: string;
  previousRole: string;
  newRole: string;
  added: string[];
  removed: string[];
  resource: string;
  tenant: string;
}

export const auditEvents: AuditEvent[] = [
  {
    id: 'AUD-2026-0916-001',
    timestamp: '16 sep 2026 · 09:42:18',
    dateLabel: 'Hoy',
    user: 'María González',
    role: 'Supervisora',
    tenant: 'Organización autenticada',
    module: 'Documentos',
    action: 'Aprobó documento',
    resource: 'Política de seguridad de la información',
    ip: '10.24.8.14',
    device: 'MacBook Pro',
    browser: 'Chrome 140',
    result: 'Exitoso',
    details: 'La aprobación completó la etapa 3 de 3 del workflow institucional.',
    icon: '✓',
    tone: 'teal',
  },
  {
    id: 'AUD-2026-0916-002',
    timestamp: '16 sep 2026 · 09:18:04',
    dateLabel: 'Hoy',
    user: 'Carlos Méndez',
    role: 'Supervisor',
    tenant: 'Organización autenticada',
    module: 'Documentos',
    action: 'Modificó documento',
    resource: 'Contrato marco proveedores 2025',
    ip: '10.24.8.31',
    device: 'Dell Latitude',
    browser: 'Edge 140',
    result: 'Exitoso',
    details: 'Se actualizó la fecha de vigencia y se creó la versión 4.',
    icon: '✎',
    tone: 'blue',
    before: { Vigencia: '31 dic 2025', Estado: 'En revisión' },
    after: { Vigencia: '31 dic 2026', Estado: 'En revisión' },
  },
  {
    id: 'AUD-2026-0916-003',
    timestamp: '16 sep 2026 · 08:57:41',
    dateLabel: 'Hoy',
    user: 'Ana López',
    role: 'Usuario operativo',
    tenant: 'Organización autenticada',
    module: 'Documentos',
    action: 'Descargó archivo',
    resource: 'Manual de incorporación.pdf',
    ip: '10.24.9.08',
    device: 'iPhone 15',
    browser: 'Safari 18',
    result: 'Exitoso',
    details: 'Descarga de la versión vigente solicitada desde el expediente de RR. HH.',
    icon: '↓',
    tone: 'purple',
  },
  {
    id: 'AUD-2026-0916-004',
    timestamp: '16 sep 2026 · 08:44:12',
    dateLabel: 'Hoy',
    user: 'Javier Ruiz',
    role: 'Auditor',
    tenant: 'Organización autenticada',
    module: 'Usuarios',
    action: 'Intentó acceder',
    resource: 'Administración de permisos',
    ip: '10.24.7.19',
    device: 'ThinkPad X1',
    browser: 'Firefox 141',
    result: 'Rechazado',
    details: 'El rol visual no tiene permiso para administrar asignaciones RBAC.',
    icon: '!',
    tone: 'rose',
  },
  {
    id: 'AUD-2026-0915-005',
    timestamp: '15 sep 2026 · 17:26:30',
    dateLabel: 'Ayer',
    user: 'Laura Martínez',
    role: 'Administradora de tenant',
    tenant: 'Organización autenticada',
    module: 'Expedientes',
    action: 'Creó expediente',
    resource: 'EXP-2041 · Alta de proveedor Andes',
    ip: '10.24.1.05',
    device: 'MacBook Air',
    browser: 'Chrome 140',
    result: 'Exitoso',
    details: 'Se creó la unidad documental con 3 participantes y workflow de alta.',
    icon: '+',
    tone: 'teal',
  },
  {
    id: 'AUD-2026-0915-006',
    timestamp: '15 sep 2026 · 16:11:02',
    dateLabel: 'Ayer',
    user: 'Laura Martínez',
    role: 'Administradora de tenant',
    tenant: 'Organización autenticada',
    module: 'Usuarios',
    action: 'Cambió permisos',
    resource: 'Carlos Méndez · Supervisor',
    ip: '10.24.1.05',
    device: 'MacBook Air',
    browser: 'Chrome 140',
    result: 'Exitoso',
    details: 'Se agregó el permiso de exportación de reportes para el área Legal.',
    icon: '↕',
    tone: 'amber',
    before: { Rol: 'Supervisor', 'Exportar reportes': 'No' },
    after: { Rol: 'Supervisor', 'Exportar reportes': 'Sí' },
  },
];

export const accessSessions: AccessSession[] = [
  { id: 'SES-7781', user: 'Laura Martínez', role: 'Administradora de tenant', status: 'Activa', start: '16 sep · 08:12', end: '—', duration: '1 h 31 min', actions: 48, device: 'MacBook Air', ip: '10.24.1.05', browser: 'Chrome 140', tenant: 'Organización autenticada' },
  { id: 'SES-7778', user: 'Carlos Méndez', role: 'Supervisor', status: 'Activa', start: '16 sep · 08:31', end: '—', duration: '1 h 12 min', actions: 24, device: 'Dell Latitude', ip: '10.24.8.31', browser: 'Edge 140', tenant: 'Organización autenticada' },
  { id: 'SES-7772', user: 'Ana López', role: 'Usuario operativo', status: 'Cerrada', start: '15 sep · 15:40', end: '15 sep · 17:20', duration: '1 h 40 min', actions: 19, device: 'iPhone 15', ip: '10.24.9.08', browser: 'Safari 18', tenant: 'Organización autenticada' },
  { id: 'SES-7768', user: 'Javier Ruiz', role: 'Auditor', status: 'Bloqueada', start: '15 sep · 09:02', end: '15 sep · 09:08', duration: '6 min', actions: 3, device: 'ThinkPad X1', ip: '10.24.7.19', browser: 'Firefox 141', tenant: 'Organización autenticada' },
];

export const documentCreations: CreationActivity[] = [
  { id: 'CRE-0916-01', dateLabel: 'Hoy · 16 de septiembre', date: '2026-09-16', document: 'Política de seguridad de la información', type: 'Política', creator: 'María González', area: 'Dirección', origin: 'Plantilla institucional', status: 'Publicado', tenant: 'Organización autenticada' },
  { id: 'CRE-0916-02', dateLabel: 'Hoy · 16 de septiembre', date: '2026-09-16', document: 'Acta comité de compras · septiembre', type: 'Acta', creator: 'Ana López', area: 'Compras', origin: 'Carga de archivo', status: 'En revisión', tenant: 'Organización autenticada' },
  { id: 'CRE-0915-01', dateLabel: 'Ayer · 15 de septiembre', date: '2026-09-15', document: 'EXP-2041 · Alta de proveedor Andes', type: 'Expediente', creator: 'Laura Martínez', area: 'Compras', origin: 'Creación manual', status: 'Publicado', tenant: 'Organización autenticada' },
  { id: 'CRE-0915-02', dateLabel: 'Ayer · 15 de septiembre', date: '2026-09-15', document: 'Cotización servicios de archivo', type: 'Cotización', creator: 'Carlos Méndez', area: 'Legal', origin: 'Carga de archivo', status: 'Borrador', tenant: 'Organización autenticada' },
  { id: 'CRE-0912-01', dateLabel: '12 de septiembre', date: '2026-09-12', document: 'Informe auditoría interna Q2', type: 'Informe', creator: 'Javier Ruiz', area: 'Calidad', origin: 'Plantilla institucional', status: 'Publicado', tenant: 'Organización autenticada' },
];

export const modifications: ModificationRecord[] = [
  { id: 'MOD-2042-04', timestamp: '16 sep 2026 · 09:18', document: 'Contrato marco proveedores 2025', user: 'Carlos Méndez', role: 'Supervisor', version: 'v4', previousVersion: 'v3', summary: 'Actualizó vigencia y responsable de revisión.', fields: [{ field: 'Vigencia', before: '31 dic 2025', after: '31 dic 2026' }, { field: 'Responsable', before: 'Ana López', after: 'Carlos Méndez' }, { field: 'Cláusula 8', before: 'Renovación anual', after: 'Renovación automática anual' }], tenant: 'Organización autenticada' },
  { id: 'MOD-2041-02', timestamp: '15 sep 2026 · 16:42', document: 'Política de seguridad de la información', user: 'María González', role: 'Supervisora', version: 'v2', previousVersion: 'v1', summary: 'Añadió el apartado de gestión de incidentes.', fields: [{ field: 'Versión', before: '1.0', after: '2.0' }, { field: 'Aprobador', before: '—', after: 'Dirección' }], tenant: 'Organización autenticada' },
  { id: 'MOD-2038-01', timestamp: '12 sep 2026 · 11:09', document: 'Renovación contractual', user: 'Laura Martínez', role: 'Administradora de tenant', version: 'v6', previousVersion: 'v5', summary: 'Completó datos de clasificación del expediente.', fields: [{ field: 'Área', before: '—', after: 'Legal' }, { field: 'Retención', before: '3 años', after: '5 años' }], tenant: 'Organización autenticada' },
];

export const downloads: DownloadRecord[] = [
  { id: 'DWN-8841', document: 'Manual de incorporación.pdf', version: 'v3', type: 'PDF', user: 'Ana López', role: 'Usuario operativo', date: '16 sep 2026 · 08:57', ip: '10.24.9.08', device: 'iPhone 15', browser: 'Safari 18', size: '2.4 MB', tenant: 'Organización autenticada' },
  { id: 'DWN-8838', document: 'Contrato marco proveedores 2025.docx', version: 'v3', type: 'DOCX', user: 'Carlos Méndez', role: 'Supervisor', date: '15 sep 2026 · 16:20', ip: '10.24.8.31', device: 'Dell Latitude', browser: 'Edge 140', size: '846 KB', tenant: 'Organización autenticada' },
  { id: 'DWN-8830', document: 'Informe auditoría interna Q2.xlsx', version: 'v2', type: 'XLSX', user: 'Javier Ruiz', role: 'Auditor', date: '15 sep 2026 · 10:41', ip: '10.24.7.19', device: 'ThinkPad X1', browser: 'Firefox 141', size: '1.8 MB', tenant: 'Organización autenticada' },
  { id: 'DWN-8814', document: 'Política de seguridad.pdf', version: 'v2', type: 'PDF', user: 'María González', role: 'Supervisora', date: '12 sep 2026 · 14:05', ip: '10.24.8.14', device: 'MacBook Pro', browser: 'Chrome 140', size: '1.2 MB', tenant: 'Organización autenticada' },
];

export const approvals: ApprovalRecord[] = [
  { id: 'APR-1108', date: '16 sep 2026 · 09:42', workflow: 'Publicación de políticas', document: 'Política de seguridad de la información', status: 'Aprobado', duration: '2 d 4 h', currentStep: 3, steps: ['Revisión Legal', 'Validación de Calidad', 'Aprobación Dirección'], participants: ['Carlos Méndez', 'Javier Ruiz', 'María González'], user: 'María González', tenant: 'Organización autenticada' },
  { id: 'APR-1103', date: '15 sep 2026 · 16:18', workflow: 'Aprobación de contratos', document: 'Contrato marco proveedores 2025', status: 'Pendiente', duration: '1 d 7 h', currentStep: 2, steps: ['Revisión Compras', 'Revisión Legal', 'Aprobación Dirección'], participants: ['Ana López', 'Carlos Méndez', 'María González'], user: 'Carlos Méndez', tenant: 'Organización autenticada' },
  { id: 'APR-1097', date: '12 sep 2026 · 12:30', workflow: 'Informe trimestral', document: 'Informe auditoría interna Q2', status: 'Rechazado', duration: '3 h 20 min', currentStep: 1, steps: ['Validación Calidad', 'Aprobación Dirección'], participants: ['Javier Ruiz', 'María González'], user: 'Javier Ruiz', tenant: 'Organización autenticada' },
];

export const deletions: DeletionRecord[] = [
  { id: 'DEL-304', date: '16 sep 2026 · 07:45', resource: 'Borrador solicitud de compra', kind: 'Soft delete', deletedBy: 'Ana López', reason: 'Documento duplicado', status: 'Ejecutado', restoreAllowed: true, tenant: 'Organización autenticada' },
  { id: 'DEL-299', date: '15 sep 2026 · 18:02', resource: 'EXP-1982 · Proyecto sede norte', kind: 'Archivado', deletedBy: 'Laura Martínez', reason: 'Cierre de proyecto', status: 'Ejecutado', restoreAllowed: true, tenant: 'Organización autenticada' },
  { id: 'DEL-291', date: '12 sep 2026 · 11:30', resource: 'Cotización proveedor 2024', kind: 'Anulación', deletedBy: 'Carlos Méndez', reason: 'Reemplazada por nueva cotización', status: 'Revisar', restoreAllowed: false, tenant: 'Organización autenticada' },
];

export const permissionChanges: PermissionRecord[] = [
  { id: 'PER-551', date: '15 sep 2026 · 16:11', affectedUser: 'Carlos Méndez', modifiedBy: 'Laura Martínez', previousRole: 'Supervisor', newRole: 'Supervisor', added: ['Reportes · exportar'], removed: [], resource: 'Área Legal', tenant: 'Organización autenticada' },
  { id: 'PER-547', date: '12 sep 2026 · 09:20', affectedUser: 'Ana López', modifiedBy: 'Laura Martínez', previousRole: 'Usuario operativo', newRole: 'Supervisor', added: ['Documentos · aprobar', 'Workflows · asignar'], removed: ['Usuarios · administrar'], resource: 'Tenant completo', tenant: 'Organización autenticada' },
  { id: 'PER-539', date: '09 sep 2026 · 14:38', affectedUser: 'Javier Ruiz', modifiedBy: 'María González', previousRole: 'Auditor', newRole: 'Auditor', added: [], removed: ['Documentos · descargar'], resource: 'Área Calidad', tenant: 'Organización autenticada' },
];

export const auditViewFromPath = (path: string): AuditView => {
  const views: Record<string, AuditView> = {
    '/audit': 'general',
    '/audit/access': 'access',
    '/audit/document-creation': 'creation',
    '/audit/modifications': 'modifications',
    '/audit/downloads': 'downloads',
    '/audit/approvals': 'approvals',
    '/audit/deletions': 'deletions',
    '/audit/permissions': 'permissions',
  };
  return views[path] ?? 'general';
};
