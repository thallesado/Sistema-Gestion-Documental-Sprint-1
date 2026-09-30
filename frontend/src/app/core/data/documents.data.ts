import { DemoItem } from './data.types';

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
