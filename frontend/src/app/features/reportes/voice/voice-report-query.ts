export type ParsedVoiceReportQuery = { filters: Record<string, string>; labels: string[]; dateError?: string };

const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function naturalDateRange(text: string, now: Date): { from?: string; to?: string; error?: string } {
  const format = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const valid = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  const dates = [...text.matchAll(/\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:de|del)\s+(\d{4}))?\b/g)];
  if (dates.length) {
    const explicitYear = dates.find(match => match[3])?.[3];
    const values = dates.map(match => {
      const year = Number(match[3] || explicitYear || now.getFullYear());
      const month = months.indexOf(match[2]) + 1;
      const day = Number(match[1]);
      return valid(year, month, day) ? format(year, month, day) : '';
    });
    if (values.some(value => !value) || values.length > 2) return { error: 'Revisa las fechas indicadas.' };
    return { from: values[0], to: values[1] || values[0] };
  }
  let year = now.getFullYear();
  let month = now.getMonth();
  const named = text.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+(?:(?:de|del)\s+)?(\d{4}))?\b/);
  if (named) {
    month = months.indexOf(named[1]);
    year = Number(named[2] || year);
  } else if (/\b(?:mes pasado|mes anterior)\b/.test(text)) {
    month--;
    if (month < 0) { month = 11; year--; }
  } else if (!/\b(?:este mes|mes actual)\b/.test(text)) {
    if (/\b(?:entre|desde|hasta|fecha|ayer|hoy|semana|ano)\b|\d{1,2}[/-]\d{1,2}[/-]\d{4}/.test(text))
      return { error: 'No se pudo interpretar el periodo. Prueba «este mes», «mes pasado» o «noviembre de 2026».' };
    return {};
  }
  return { from: format(year, month + 1, 1), to: format(year, month + 1, new Date(year, month + 1, 0).getDate()) };
}

/** Converts free text into an allowlisted filter object; the original text is never returned. */
export function parseVoiceQuery(raw: string, now = new Date()): ParsedVoiceReportQuery {
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
  } else {
    const range = naturalDateRange(normalized, now);
    if (range.error) return { filters: {}, labels: [], dateError: range.error };
    if (range.from && range.to) {
      filters['dateFrom'] = range.from;
      filters['dateTo'] = range.to;
      labels.push(`Desde ${range.from}`, `hasta ${range.to}`);
    }
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
  if (!Object.keys(filters).length) labels.push('No se reconocieron filtros válidos');
  return { filters, labels };
}
