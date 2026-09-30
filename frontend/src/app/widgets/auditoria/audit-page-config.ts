import { AuditFilterField } from '../../features/auditoria/components/audit-filters';

export type AuditPageCopy = {
  title: string;
  description: string;
};

export const auditPageCopy: Record<string, AuditPageCopy> = {
  '/audit': {
    title: 'Registro general',
    description: 'Consulta cronológica de los eventos persistidos para el tenant autenticado.',
  },
  '/audit/access': {
    title: 'Accesos',
    description: 'Consulta los accesos HTTP persistidos y su contexto técnico registrado.',
  },
  '/audit/document-creation': {
    title: 'Creación de documentos',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/modifications': {
    title: 'Modificaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/downloads': {
    title: 'Descargas',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/approvals': {
    title: 'Aprobaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/deletions': {
    title: 'Eliminaciones',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
  '/audit/permissions': {
    title: 'Cambios de permisos',
    description: 'Este historial se conserva en su ruta histórica, sin registros de demostración.',
  },
};

export const generalFilters: AuditFilterField[] = [
  {
    key: 'action',
    label: 'Operación',
    type: 'select',
    options: [
      { value: 'HTTP_GET', label: 'Lectura (GET)' },
      { value: 'HTTP_POST', label: 'Creación (POST)' },
      { value: 'HTTP_PUT', label: 'Modificación (PUT)' },
      { value: 'HTTP_PATCH', label: 'Modificación parcial (PATCH)' },
    ],
  },
  { key: 'type', label: 'Tipo de recurso', placeholder: 'DOCUMENTS' },
  {
    key: 'result',
    label: 'Resultado',
    type: 'select',
    options: [
      { value: 'SUCCESS', label: 'Exitoso' },
      { value: 'FAILURE', label: 'Fallido' },
    ],
  },
  { key: 'dateFrom', label: 'Desde', type: 'date' },
  { key: 'dateTo', label: 'Hasta', type: 'date' },
];
