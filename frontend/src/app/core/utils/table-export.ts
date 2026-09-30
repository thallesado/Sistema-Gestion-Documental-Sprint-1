import { downloadBlob, ExportColumn } from './export-utils';

export type ExportRow = Record<string, string>;

/** permisos_sistema_29_09_2026.csv */
export function datedFileName(base: string, extension: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${base}_${pad(d.getDate())}_${pad(d.getMonth() + 1)}_${d.getFullYear()}.${extension}`;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function exportRowsToCsv(rows: ExportRow[], columns: ExportColumn[], baseName: string): void {
  const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => quote(c.label)), ...rows.map((r) => columns.map((c) => quote(r[c.key] ?? '')))];
  const content = '﻿' + lines.map((line) => line.join(',')).join('\r\n');
  downloadBlob(new Blob([content], { type: 'text/csv;charset=utf-8;' }), datedFileName(baseName, 'csv'));
}

/** Tabla HTML que Excel abre de forma nativa (sin librerías). Excel puede avisar del formato al abrirla. */
export function exportRowsToExcel(rows: ExportRow[], columns: ExportColumn[], baseName: string): void {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => `<td>${escapeHtml(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('');
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  downloadBlob(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), datedFileName(baseName, 'xls'));
}

/** jsPDF se carga bajo demanda para no aumentar el bundle inicial. */
export async function exportRowsToPdf(rows: ExportRow[], columns: ExportColumn[], baseName: string, title: string): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => r[c.key] ?? '')),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [19, 128, 114] },
  });
  doc.save(datedFileName(baseName, 'pdf'));
}
