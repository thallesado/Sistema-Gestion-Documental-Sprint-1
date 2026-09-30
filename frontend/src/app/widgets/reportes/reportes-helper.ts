import { ChartPoint, ReportDefinition, ReportRow } from '../../core/data/report-data';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../core/utils/export-utils';

export function buildFilterSummary(report: ReportDefinition, values: Record<string, string>): string {
  const parts: string[] = [];
  for (const filter of report.filters) {
    const val = values[filter.key];
    if (val && val !== 'all') {
      const opt = filter.options?.find((o: any) => typeof o === 'string' ? o === val : o?.value === val);
      const optLabel = typeof opt === 'string' ? opt : (opt as any)?.label || val;
      parts.push(`${filter.label}: ${optLabel}`);
    }
  }
  return parts.length ? parts.join(' · ') : 'Sin filtros aplicados';
}

export function generateChartPoints(rows: ReportRow[], groupBy: string): ChartPoint[] {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = String((row as any)[groupBy] || 'Otro');
    const val = typeof row['value'] === 'number' ? row['value'] : 1;
    counts[key] = (counts[key] || 0) + (typeof val === 'number' ? val : 1);
  }
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

export function handleReportExport(format: 'Excel' | 'PDF' | 'JSON', title: string, rows: ReportRow[], columns: ExportColumn[]): void {
  const fileName = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
  if (format === 'Excel') {
    exportToCsv(rows, `${fileName}.csv`, columns);
  } else if (format === 'JSON') {
    exportToJson(rows, `${fileName}.json`);
  } else if (format === 'PDF') {
    exportToPrintView(title, 'Reporte institucional', rows, columns);
  }
}
