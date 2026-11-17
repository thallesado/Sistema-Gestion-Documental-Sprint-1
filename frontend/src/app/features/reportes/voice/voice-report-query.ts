export type ParsedVoiceReportQuery = { filters: Record<string, string>; labels: string[] };

/** Converts free text into an allowlisted filter object; the original text is never returned. */
export function parseVoiceQuery(raw: string): ParsedVoiceReportQuery {
  const normalized = raw.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();
  const filters: Record<string, string> = {};
  const labels: string[] = [];
  const dateParts = [...normalized.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)]
    .map((m) => ({ year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) }))
    .filter(({ year, month, day }) => {
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    });
  if (dateParts.length >= 2) {
    filters['dateFrom'] = `${dateParts[0].year}-${String(dateParts[0].month).padStart(2, '0')}-${String(dateParts[0].day).padStart(2, '0')}`;
    filters['dateTo'] = `${dateParts[1].year}-${String(dateParts[1].month).padStart(2, '0')}-${String(dateParts[1].day).padStart(2, '0')}`;
    labels.push(`Desde ${filters['dateFrom']}`, `hasta ${filters['dateTo']}`);
  }
  const status: Record<string, string> = {
    aprobado: 'APPROVED', aprobados: 'APPROVED', aprobada: 'APPROVED', aprobadas: 'APPROVED',
    pendiente: 'PENDING', pendientes: 'PENDING', borrador: 'DRAFT', borradores: 'DRAFT',
    activo: 'ACTIVE', activos: 'ACTIVE', completado: 'COMPLETED', completados: 'COMPLETED',
  };
  const statusWord = Object.keys(status).find((word) => new RegExp(`\\b${word}\\b`).test(normalized));
  if (statusWord) { filters['status'] = status[statusWord]; labels.push(`Estado ${status[statusWord]}`); }
  const area = normalized.match(/\b(?:area|departamento)\s+([\p{L}][\p{L} ]{1,45}?)(?=\s+(?:entre|desde|hasta|aprobados?|pendientes?|borradores?)\b|$)/u)?.[1]?.trim();
  if (area) { filters['area'] = area.slice(0, 60); labels.push(`Área: ${area.slice(0, 60)}`); }
  if (!filters['status'] && !filters['area'] && dateParts.length < 2) labels.push('No se reconocieron filtros válidos');
  return { filters, labels };
}
