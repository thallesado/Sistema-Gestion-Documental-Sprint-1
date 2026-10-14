// Pure helpers for the OCR digitization screens: they turn API data into what the
// UI shows, so no figure on screen can be anything but a stored, measured value.

export type OcrJobStatus =
  | 'QUEUED' | 'PROCESSING' | 'REQUIRES_VALIDATION' | 'VALIDATED' | 'INDEXED' | 'FAILED' | 'REJECTED';

export interface OcrStatsData {
  engineConfigured: boolean;
  total: number;
  successful: number;
  failed: number;
  indexed: number;
  reviewed: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number | null;
  averageConfidence: number | null;
  averageProcessingSeconds: number | null;
}

export interface OcrStatCard {
  label: string;
  value: string;
  detail: string;
  note?: string;
}

export type OcrStatsLoadState = 'loading' | 'error' | 'ready';

const EMPTY = '—';

export function buildStatCards(stats: OcrStatsData | null, state: OcrStatsLoadState): OcrStatCard[] {
  const pending = state === 'error' ? 'No se pudieron cargar las métricas' : 'Cargando métricas...';
  if (!stats) {
    return [
      { label: 'Digitalizaciones', value: EMPTY, detail: pending },
      { label: 'Aceptación por revisión humana', value: EMPTY, detail: pending },
      { label: 'Tiempo promedio de procesamiento', value: EMPTY, detail: pending },
    ];
  }
  return [
    {
      label: 'Digitalizaciones',
      value: String(stats.total),
      detail: stats.total === 0 ? 'Sin digitalizaciones aún' : `${stats.indexed} indexadas en el repositorio`,
    },
    {
      label: 'Aceptación por revisión humana',
      value: stats.acceptanceRate == null ? EMPTY : `${(stats.acceptanceRate * 100).toFixed(1)}%`,
      detail: stats.reviewed === 0 ? 'Sin revisiones aún' : `${stats.accepted} de ${stats.reviewed} extracciones revisadas`,
      note: stats.averageConfidence == null
        ? undefined
        : `Confianza media del modelo (autodeclarada): ${(stats.averageConfidence * 100).toFixed(0)}%`,
    },
    {
      label: 'Tiempo promedio de procesamiento',
      value: stats.averageProcessingSeconds == null ? EMPTY : `${stats.averageProcessingSeconds.toFixed(1)} s`,
      detail: stats.successful === 0 ? 'Sin extracciones exitosas aún' : 'Solo extracciones exitosas',
    },
  ];
}

/** Where a stored digitization continues: the first step that is still pending. */
export function routeForStatus(status: OcrJobStatus): string | null {
  switch (status) {
    case 'REQUIRES_VALIDATION': return '/digitization/ocr';
    case 'VALIDATED': return '/digitization/indexing';
    case 'INDEXED': return '/digitization/metadata';
    default: return null;
  }
}

export function statusLabel(status: OcrJobStatus | 'IDLE' | 'ERROR'): string {
  switch (status) {
    case 'QUEUED': return 'En cola';
    case 'PROCESSING': return 'Procesando';
    case 'REQUIRES_VALIDATION': return 'Por validar';
    case 'VALIDATED': return 'Validada';
    case 'INDEXED': return 'Indexada';
    case 'FAILED': return 'Fallida';
    case 'REJECTED': return 'Rechazada';
    case 'ERROR': return 'Error';
    default: return 'Sin documento';
  }
}

export interface OcrMetadataFields {
  documentType: string;
  patientName: string;
  patientDocumentNumber: string;
  doctorName: string;
  issueDate: string;
}

/** Only the fields the reviewer actually changed; the API treats a missing field as "no change". */
export function changedMetadata(
  edits: Partial<OcrMetadataFields>,
  current: Partial<Record<keyof OcrMetadataFields, string | null | undefined>>,
): Partial<OcrMetadataFields> {
  const result: Partial<OcrMetadataFields> = {};
  (Object.keys(edits) as (keyof OcrMetadataFields)[]).forEach((key) => {
    const value = (edits[key] ?? '').trim();
    if (value !== '' && value !== (current[key] ?? '')) result[key] = value;
  });
  return result;
}
