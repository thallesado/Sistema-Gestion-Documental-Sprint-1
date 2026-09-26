/**
 * Utilities for client-side data export to CSV (Excel compatible), JSON, and Print/PDF.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ExportColumn {
  key: string;
  label: string;
}

export function exportToCsv(
  rows: Record<string, any>[],
  filename: string,
  columns?: ExportColumn[]
): void {
  if (!rows || rows.length === 0) {
    alert('No hay datos disponibles para exportar con los filtros actuales.');
    return;
  }

  const effectiveCols: ExportColumn[] = columns && columns.length > 0
    ? columns
    : Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const headerLine = effectiveCols.map((c) => `"${(c.label || c.key).replace(/"/g, '""')}"`).join(';');

  const dataLines = rows.map((row) =>
    effectiveCols
      .map((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return '""';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(';')
  );

  // BOM UTF-8 (\uFEFF) for Excel compatibility
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const finalName = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  downloadBlob(blob, finalName);
}

export function exportToJson(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    alert('No hay datos disponibles para exportar con los filtros actuales.');
    return;
  }
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const finalName = filename.endsWith('.json') ? filename : `${filename}.json`;
  downloadBlob(blob, finalName);
}

export function exportToPrintView(
  title: string,
  subtitle: string,
  rows: Record<string, any>[],
  columns?: ExportColumn[]
): void {
  if (!rows || rows.length === 0) {
    alert('No hay datos disponibles para imprimir o exportar a PDF.');
    return;
  }

  const effectiveCols: ExportColumn[] = columns && columns.length > 0
    ? columns
    : Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const headersHtml = effectiveCols
    .map((c) => `<th style="border: 1px solid #d4ece7; padding: 10px 12px; background: #f0f9f7; text-align: left; font-size: 12px; font-weight: 700; color: #138072;">${c.label}</th>`)
    .join('');

  const rowsHtml = rows
    .map((row) => {
      const cells = effectiveCols
        .map((col) => {
          const val = row[col.key];
          const display = val === null || val === undefined ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `<td style="border: 1px solid #e2ece9; padding: 8px 12px; font-size: 12px; color: #1a3038;">${display}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const nowStr = new Date().toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${title} - NexoDocs</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 28px; color: #1a3038; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #138072; padding-bottom: 14px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; margin: 0 0 4px; color: #138072; }
    .header p { margin: 0; color: #648280; font-size: 13px; }
    .badge { background: #e0f4f0; color: #138072; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    tr:nth-child(even) { background-color: #fafdfc; }
    .footer { margin-top: 28px; font-size: 11px; color: #8a9e9c; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
    @media print {
      body { margin: 1cm; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="badge">
      NexoDocs SGDEA<br><small style="font-weight: normal; font-size: 10px;">${nowStr}</small>
    </div>
  </div>
  <table>
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    Reporte generado desde NexoDocs · Total de registros: ${rows.length}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 200);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
